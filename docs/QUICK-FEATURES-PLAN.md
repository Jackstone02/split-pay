# Quick Features Plan

> These are small, self-contained features to ship before the main FEATURE-PLAN.md work.
> No DB migrations needed. No new dependencies. Estimated: 1 session each.

---

## Feature A: Activity Screen Deep Linking

### Problem
Activity items are `<View>` — not tappable. Users see "John created bill Dinner at Jollibee" but have to manually navigate to Bills to find it.

### What changes

**Only 1 file:** `src/screens/activity/ActivityScreen.tsx`

---

### Current state

```
renderActivityItem → <View style={styles.activityItem}>  ← not tappable
```

`getUserActivities` in `supabaseApi.ts` already returns `billId` and `groupId` from the payload (lines 1845–1846). The `Activity` type already has both fields. **No service or type changes needed.**

---

### Navigation logic

```typescript
const handleActivityPress = (activity: Activity) => {
  if (activity.type === 'bill_deleted') {
    // Can't navigate — bill is gone
    return; // non-tappable (keep as View)
  }
  if (activity.billId) {
    navigation.navigate('BillDetail', { billId: activity.billId });
    return;
  }
  if (activity.groupId) {
    navigation.navigate('GroupDetail', { groupId: activity.groupId });
    return;
  }
  // friend_added and anything with no billId/groupId → non-tappable
};
```

### Navigation destination per activity type

| Activity Type | Destination | Notes |
|---|---|---|
| `bill_created` | `BillDetail` | via `billId` |
| `bill_updated` | `BillDetail` | via `billId` |
| `bill_settled` | `BillDetail` | via `billId` |
| `bill_deleted` | — | non-tappable, bill no longer exists |
| `payment_made` | `BillDetail` | via `billId` |
| `payment_confirmed` | `BillDetail` | via `billId` |
| `payment_requested` | `BillDetail` | via `billId` |
| `poke` / `poke_sent` / `poke_received` | `BillDetail` | via `billId` |
| `group_created` | `GroupDetail` | via `groupId` |
| `group_updated` | `GroupDetail` | via `groupId` |
| `member_added` | `GroupDetail` | via `groupId` |
| `member_removed` | `GroupDetail` | via `groupId` |
| `friend_added` | — | non-tappable (no detail screen for this) |

---

### UI changes

1. **`renderActivityItem`** — wrap with `TouchableOpacity` when tappable, keep `View` when not:

```tsx
const isTappable = (activity: Activity) =>
  activity.type !== 'bill_deleted' &&
  activity.type !== 'friend_added' &&
  (!!activity.billId || !!activity.groupId);

// In render:
const Wrapper = isTappable(item) ? TouchableOpacity : View;

return (
  <Wrapper
    style={styles.activityItem}
    onPress={isTappable(item) ? () => handleActivityPress(item) : undefined}
    activeOpacity={0.7}
  >
    ...existing content...
    {isTappable(item) && (
      <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.gray400} />
    )}
  </Wrapper>
);
```

2. **Add `useNavigation` hook** — `ActivityScreen` is a tab screen so navigation is available via hook:
```typescript
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation<any>();
```

3. **`activityItem` style** — no changes needed, the chevron fits naturally after the existing `activityAmount`.

---

### What does NOT change
- `supabaseApi.ts` — `getUserActivities` already returns `billId` and `groupId`
- `src/types/index.ts` — `Activity` already has `billId?` and `groupId?`
- Navigation stack — `BillDetail` and `GroupDetail` are already registered

---

## Feature B: Payer Marks Others as Paid

### Problem
Currently, only the person who **owes** can mark a payment. The payer has to wait. But in real life, someone pays cash on the spot and the payer wants to mark it as received immediately without waiting for the other person to open the app.

### What changes

**2 files:**
- `src/screens/bills/BillDetailScreen.tsx` — new button in payment card
- `src/services/supabaseApi.ts` — new API method

---

### Current payment flow (for context)

```
Debtor:   [Mark as Paid]       → status = pending_confirmation
Payer:    [Confirm Received]   → status = confirmed  ← only after debtor acts first
```

### New flow (with this feature)

```
Debtor:   [Mark as Paid]       → status = pending_confirmation
Payer:    [Confirm Received]   → status = confirmed  ← existing (after debtor marks paid)

Payer:    [Mark as Received]   → status = confirmed  ← NEW (proactive, skip pending step)
          (only shown when payment is still 'unpaid')
```

The payer can now say "I already got the cash from this person" and skip the whole back-and-forth.

---

### New supabaseApi method

```typescript
async payerMarkAsReceived(
  billId: string,
  fromUserId: string,
  toUserId: string
): Promise<void> {
  // Directly set to confirmed — payer is saying they already received cash
  const { error } = await supabase
    .schema('amot')
    .from('bill_splits')
    .update({
      payment_status: 'confirmed',
      settled: true,
      settled_at: new Date().toISOString(),
      marked_paid_at: new Date().toISOString(),
    })
    .eq('bill_id', billId)
    .eq('user_id', fromUserId);

  if (error) throw error;

  // Log activity so the debtor gets notified
  await this.createActivity({
    actorId: toUserId,
    action: 'payment_confirmed',
    targetId: fromUserId,
    payload: { billId, fromUserId, toUserId },
  });
}
```

---

### BillDetailScreen changes

**Where to add the button** — inside the existing payment card, after the poke button section.

**Visibility condition:**
```typescript
const isPayerMarkingReceived =
  !isCurrent &&                                          // not the person who owes
  user?.id === payment.toUserId &&                       // you're the receiver (payer)
  !payment.isPaid &&                                     // not already paid
  payment.paymentStatus !== 'confirmed' &&               // not already confirmed
  payment.paymentStatus !== 'pending_confirmation';      // don't show alongside existing confirm button
                                                         // (pending_confirmation has its own confirm button)
```

**New button UI** — subtle secondary style, below the poke button:

```tsx
{isPayerMarkingReceived && (
  <TouchableOpacity
    style={styles.markReceivedButton}
    onPress={() => handlePayerMarkAsReceived(payment)}
    disabled={updatingPayment}
  >
    {updatingPayment ? (
      <ActivityIndicator color={COLORS.primary} size="small" />
    ) : (
      <>
        <MaterialCommunityIcons name="cash-check" size={16} color={COLORS.primary} />
        <Text style={styles.markReceivedText}>Mark as Received</Text>
      </>
    )}
  </TouchableOpacity>
)}
```

**New handler:**
```typescript
const handlePayerMarkAsReceived = (payment: any) => {
  modal.showModal({
    type: 'confirm',
    title: 'Mark as Received',
    message: `Confirm that you received ${formatAmount(payment.amount, user?.preferredCurrency)} from ${users[payment.fromUserId]?.name ?? 'this person'}?`,
    confirmText: 'Yes, Mark Received',
    showCancel: true,
    onConfirm: async () => {
      try {
        setUpdatingPayment(true);
        await supabaseApi.payerMarkAsReceived(billId, payment.fromUserId, user!.id);
        const updatedBill = await getBillById(billId);
        if (updatedBill) setBill(updatedBill);
        modal.showModal({
          type: 'success',
          title: 'Marked as Received',
          message: 'Payment has been marked as received.',
        });
      } catch (error) {
        modal.showModal({ type: 'error', title: 'Error', message: 'Failed to update payment.' });
      } finally {
        setUpdatingPayment(false);
      }
    },
  });
};
```

**New styles to add:**
```typescript
markReceivedButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACING.xs,
  marginTop: SPACING.md,
  paddingVertical: SPACING.sm,
  borderWidth: 1,
  borderColor: COLORS.primary,
  borderRadius: BORDER_RADIUS.md,
  paddingHorizontal: SPACING.lg,
},
markReceivedText: {
  color: COLORS.primary,
  fontSize: FONT_SIZES.sm,
  fontWeight: '600',
},
```

---

### Payment card states summary (after this feature)

| Who you are | Payment status | Buttons shown |
|---|---|---|
| Debtor | unpaid | Pay Now + Mark as Paid |
| Debtor | pending_confirmation | Cancel Payment (undo) |
| Debtor | confirmed | — |
| Payer | unpaid | Poke + **Mark as Received** ← NEW |
| Payer | pending_confirmation | Confirm Payment Received |
| Payer | confirmed | Undo Confirmation |

---

## Build Order

```
Feature A (Activity Deep Linking)   → ~30 mins, 1 file
Feature B (Payer Marks Received)    → ~1 hour, 2 files
```

Do A first — it's pure read-only navigation, zero risk. Then B.

## Files Summary

| Feature | Status | File |
|---|---|---|
| A | MODIFY | `src/screens/activity/ActivityScreen.tsx` |
| B | MODIFY | `src/services/supabaseApi.ts` |
| B | MODIFY | `src/screens/bills/BillDetailScreen.tsx` |

**Total: 3 files modified. No new files. No DB changes. No new dependencies.**
