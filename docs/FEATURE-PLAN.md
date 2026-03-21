# Amot — New Features Implementation Plan

> Last updated: 2026-03-09
> Features: Bill Creation Flows (Manual / Scan Receipt / Ask AI) + Email Notifications

---

## Overview

Three new features to implement:

1. **Scan Receipt Flow** — upload a receipt photo, AI extracts the items, user manually assigns each item to participants with per-item split options.
2. **Ask AI Flow** — upload a receipt photo + type a natural language prompt describing how to split it, AI does all the assignment and returns a ready-to-confirm bill.
3. **Email Notifications** — send email alongside existing push notifications for all bill/payment/friend/group events. Users can opt out from profile settings.

---

## Bill Creation Entry Point

When the user starts creating a bill, they first see a **creation mode picker** (bottom sheet or modal):

```
┌─────────────────────────────────────┐
│   How do you want to create this    │
│   bill?                             │
│                                     │
│  📝  Manual Entry                   │
│       Fill in the details yourself  │
│                                     │
│  🧾  Scan Receipt                   │
│       Upload a photo, assign items  │
│                                     │
│  🤖  Ask AI                         │
│       Upload receipt + describe     │
│       how to split it               │
└─────────────────────────────────────┘
```

- **Manual Entry** → existing `CreateBillScreen` flow, unchanged
- **Scan Receipt** → new flow: extract items → manual assignment UI
- **Ask AI** → new flow: extract items + process prompt → AI pre-fills everything

---

## Feature 1: Scan Receipt Flow

### How it works (end-to-end)

```
1. User selects "Scan Receipt" from picker
2. ImagePicker opens → user picks receipt photo
3. Image uploaded to Supabase Storage (bill-attachments bucket)
4. Loading overlay: "Scanning receipt..."
5. App calls Edge Function: scan-receipt (image URL only)
6. Gemini Flash extracts items → returns JSON list
7. ReceiptItemsModal opens with unassigned items
8. User adds participants (who's splitting this bill)
9. User assigns each item:
   - Specific person  → one person pays full item price
   - Equal split      → selected participants split equally
   - Percentage       → custom % per participant
10. Running per-person totals shown in sticky footer
11. User taps "Confirm Items"
12. Total auto-filled from item sum, splitMethod = 'item-based'
13. User reviews normal bill fields (title, date, category, description)
14. Taps "Create Bill" → saves bill + bill_items + bill_splits
15. BillDetailScreen shows "Receipt Items" section
```

### Correct Split Computation

```
Receipt Items                              Per-Person Calculation
─────────────────────────────────────────────────────────────────────
Burger   ₱120  → PersonA (specific)        PersonA: +₱120
Pizza    ₱350  → PersonA & PersonB (equal) PersonA: +₱175  PersonB: +₱175
Drinks   ₱150  → All 3 (equal)             PersonA: +₱50   PersonB: +₱50   PersonC: +₱50
─────────────────────────────────────────────────────────────────────
bill_splits result:
  PersonA  ₱345   (120 + 175 + 50)
  PersonB  ₱225   (175 + 50)
  PersonC  ₱ 50   (50)
  ─────────
  Total    ₱620   ✓ (120 + 350 + 150)
```

**computeSplitsFromItems() rule per item:**
- `specific`   → full `totalPrice` to `assignedTo[0]`
- `equal`      → `totalPrice ÷ assignedTo.length` to each person in `assignedTo`
- `percentage` → `totalPrice × (percentage / 100)` to each person

---

## Feature 2: Ask AI Flow

### Screen layout & step order

The user completes steps in this exact order — each step unlocks the next:

```
AskAIBillScreen
──────────────────────────────────────────
Step 1: Upload Receipt

  [📷 Tap to upload receipt]
  ┌────────────────────────────────────┐
  │        receipt-preview.jpg         │  ← shown after pick
  └────────────────────────────────────┘

──────────────────────────────────────────
Step 2: Who's included?           ← unlocked after receipt uploaded
  (reuses existing participant picker from CreateBillScreen)

  [+ Add People]
  ┌──────────────────────────────────┐
  │ 👤 John Santos   ×              │
  │ 👤 Sarah Cruz    ×              │
  │ 👤 Mike Reyes    ×              │
  └──────────────────────────────────┘
  💡 You (payer) are always included automatically

──────────────────────────────────────────
Step 3: How should this be split?  ← unlocked after ≥1 participant added

  ┌────────────────────────────────────┐
  │ John pays for the burger.         │
  │ Sarah and Mike split the pizza.   │
  │ Everyone splits the drinks        │
  │ equally.                          │
  └────────────────────────────────────┘
  💡 Use names: John Santos, Sarah Cruz,
     Mike Reyes, You

  [🤖 Generate Bill]  ← enabled only when all 3 steps are filled
──────────────────────────────────────────
```

**Why participants must be selected first:**
- Friends list has real names + unique IDs — no ambiguity even if two friends share the same first name (e.g. two "Johns")
- The selected participant names are shown as a hint below the prompt so the user knows exactly what names to type
- The edge function receives `{ id, name }` pairs — Gemini maps names from the prompt to the correct IDs
- Prevents the AI from guessing wrong when names are common or abbreviated

### How it works (end-to-end)

```
1. User selects "Ask AI" from picker
2. AskAIBillScreen opens
3. Step 1 — User uploads receipt photo → preview shown
4. Step 2 — User selects friends from their friends list
            (same picker UI as CreateBillScreen, reused)
            You (payer) auto-included, cannot be removed
5. Step 3 — User types natural language prompt
            Hint shows exact names of selected participants
6. Taps "Generate Bill" (disabled until all 3 steps complete)
7. Loading overlay: "AI is creating your bill..."
8. App calls Edge Function: ai-create-bill with:
   - imageUrl
   - participants: [{ id, name }, ...] (from selected friends + self)
   - prompt: user's text
9. Gemini processes receipt image + participants + prompt in one call
10. Returns structured bill data with AI-assigned items
11. AIBillReviewScreen opens — user reviews, can still adjust
12. Taps "Confirm & Create" → bill saved
```

### What gets sent to the edge function

```json
{
  "imageUrl": "https://supabase.../bill-attachments/...",
  "participants": [
    { "id": "uuid-you",   "name": "You (Payer)" },
    { "id": "uuid-john",  "name": "John Santos" },
    { "id": "uuid-sarah", "name": "Sarah Cruz" },
    { "id": "uuid-mike",  "name": "Mike Reyes" }
  ],
  "prompt": "John pays for the burger. Sarah and Mike split the pizza. Everyone splits the drinks equally."
}
```

### AI Prompt to Gemini (inside edge function)

```
You are a bill-splitting assistant. Analyze the receipt image and follow the user's instructions exactly.

These are the only participants (use their exact IDs in assignedTo):
- You (Payer)  → id: "uuid-you"
- John Santos  → id: "uuid-john"
- Sarah Cruz   → id: "uuid-sarah"
- Mike Reyes   → id: "uuid-mike"

User's instructions: "John pays for the burger. Sarah and Mike split the pizza. Everyone splits the drinks equally."

Return ONLY valid JSON, no markdown, no explanation:
{
  "suggestedTitle": string,
  "suggestedCategory": "food"|"transport"|"utilities"|"entertainment"|"shopping"|"other",
  "totalAmount": number,
  "items": [
    {
      "name": string,
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "assignedTo": [userId, ...],
      "splitMethod": "specific"|"equal"|"percentage",
      "percentages": { "userId": number } | null
    }
  ]
}

Rules:
- Use ONLY the participant IDs listed above — never invent new IDs
- "everyone" or "all" in the prompt means all participant IDs
- If the prompt doesn't mention an item, split it equally among everyone
- Names in the prompt may be first name only — match to the closest participant
- Percentages for a single item must sum to 100
- totalAmount must equal the sum of all item totalPrices
```

### AIBillReviewScreen layout

```
AIBillReviewScreen
──────────────────────────────────────────
← Review AI Bill

Title:    [Dinner at Jollibee      ]  ← editable text input
Category: [🍔 Food          ▾     ]  ← dropdown/picker
Date:     [Mar 9, 2026             ]  ← date picker

Receipt Items                    (tap any row to adjust)
─────────────────────────────────────────
Burger × 1      ₱120   John Santos
Pizza × 1       ₱350   Sarah Cruz, Mike Reyes
Drinks × 3      ₱150   Everyone
─────────────────────────────────────────

Split Summary
─────────────────────────────────────────
You (Payer)   ₱ 50
John Santos   ₱170   (120 + 50)
Sarah Cruz    ₱225   (175 + 50)
Mike Reyes    ₱175   (175 + 50)  ← wait, wrong example
─────────────────────────────────────────
Total         ₱620   ✓

          [✓ Confirm & Create]
──────────────────────────────────────────
```

Tapping a receipt item row opens `ReceiptItemsModal` scoped to that single item so the user can adjust if the AI got it wrong.

### Key differences from Scan Receipt flow

| | Scan Receipt | Ask AI |
|---|---|---|
| Item extraction | Gemini (vision only) | Gemini (vision + text prompt) |
| Participant selection | During/after item review | **Before** typing the prompt |
| Item assignment | User does manually in UI | AI does it based on prompt |
| Edge function | `scan-receipt` | `ai-create-bill` (separate) |
| Review step | `ReceiptItemsModal` (full controls) | `AIBillReviewScreen` (lighter) |
| User effort | Medium | Low |
| Ambiguity risk | None (manual) | Low — participant names provided as context |

---

## Feature 3: Email Notifications

### How it works

```
Any action (bill created, payment made, poke, etc.)
    ↓
supabaseApi.ts (already sends push notification)
    ↓ (in parallel, non-blocking)
emailService.ts → Supabase Edge Function: send-notification-email
    ↓
Resend API → email sent to recipient's inbox
```

### Events that trigger email

| Event | Email Subject |
|---|---|
| `bill_created` | "[Name] added you to a bill: [Title]" |
| `bill_updated` | "[Name] updated bill: [Title]" |
| `bill_deleted` | "[Name] deleted bill: [Title]" |
| `bill_settled` | "Bill settled: [Title]" |
| `payment_made` | "[Name] marked payment as paid — please confirm" |
| `payment_confirmed` | "[Name] confirmed your payment for [Title]" |
| `friend_added` | "[Name] added you as a friend on Amot" |
| `group_created` | "[Name] added you to group: [GroupName]" |
| `member_added` | "[Name] joined group: [GroupName]" |
| `poke` | "[Name] is reminding you about [Amount] for [Title]" |

---

## What Needs to Change

### 1. Database Migration

**File to create:** `database/migrations/add_bill_items_and_email_prefs.sql`

```sql
-- ============================================================
-- New table: amot.bill_items
-- Stores AI-extracted line items from receipt photos
-- CASCADE delete: items removed automatically when bill is deleted
-- ============================================================
CREATE TABLE IF NOT EXISTS amot.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES amot.bills(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  assigned_to uuid[] NOT NULL DEFAULT '{}',
  split_method text NOT NULL DEFAULT 'equal'
    CHECK (split_method IN ('specific', 'equal', 'percentage')),
  percentages jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON amot.bill_items(bill_id);

-- ============================================================
-- Add email notification preference to user_profiles
-- Default true: existing users receive emails unless they opt out
-- ============================================================
ALTER TABLE amot.user_profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true;
```

**Safety:** Both changes are additive. Existing rows and existing app builds are unaffected.

---

### 2. Type Updates

**File to modify:** `src/types/index.ts`

#### a) Replace existing `BillItem` stub (line 93) with full interface

```typescript
export interface BillItem {
  id: string;
  billId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  assignedTo: string[];
  splitMethod: 'specific' | 'equal' | 'percentage';
  percentages?: { [userId: string]: number };
}
```

#### b) Add `receiptItems` to `Bill`

```typescript
receiptItems?: BillItem[];
```

#### c) Add `receiptItems` to `CreateBillData`

```typescript
receiptItems?: BillItem[];
```

#### d) Add `emailNotificationsEnabled` to `User`

```typescript
emailNotificationsEnabled?: boolean;
```

> `SplitMethod` already has `'item-based'` at line 33 — no change needed.

---

### 3. Supabase Edge Functions

#### a) `supabase/functions/scan-receipt/index.ts` (NEW)

- **Input:** `{ imageUrl: string }`
- **Calls:** Gemini Flash vision
- **Output:** `{ items: BillItem[] }` — items with no `assignedTo` (user assigns manually)
- **Secret:** `GEMINI_API_KEY`
- **Free tier:** 1,500 req/day

#### b) `supabase/functions/ai-create-bill/index.ts` (NEW)

- **Input:** `{ imageUrl: string, participants: { id, name }[], prompt: string }`
- **Calls:** Gemini Flash (vision + text, single multimodal call)
- **Output:** `{ suggestedTitle, suggestedCategory, totalAmount, items: BillItem[] }` — items with `assignedTo` pre-filled by AI
- **Secret:** `GEMINI_API_KEY` (same key, same free tier quota)
- **Error handling:** If AI response is unparseable, return error → app shows retry prompt

#### c) `supabase/functions/send-notification-email/index.ts` (NEW)

- **Input:** `{ to, eventType, payload, recipientName }`
- **Calls:** Resend API
- **Secret:** `RESEND_API_KEY`
- **Free tier:** 3,000 emails/month

---

### 4. New Service Files

#### `src/services/emailService.ts` (NEW)

Thin wrapper around `send-notification-email` edge function. Always non-blocking.

---

### 5. Utility Update

**File to modify:** `src/utils/calculations.ts`

Add `computeSplitsFromItems(items: BillItem[], allParticipantIds: string[]): Split[]`

- Iterates items, distributes each item's `totalPrice` by `splitMethod`
- Aggregates per `userId`
- Returns `Split[]` (same shape as existing splits)

---

### 6. New Components

#### a) `src/components/BillCreationPickerModal.tsx` (NEW)

Bottom sheet modal shown when user starts creating a bill. Three options:
- Manual Entry
- Scan Receipt
- Ask AI

Shown before `CreateBillScreen` loads (triggered from wherever "Create Bill" is tapped in navigation).

#### b) `src/components/ReceiptItemsModal.tsx` (NEW)

Full-screen modal for **Scan Receipt** flow. User manually assigns items.

```
┌─────────────────────────────────┐
│ [Cancel]  Receipt Items  [Done] │
├─────────────────────────────────┤
│ Burger × 1              ₱120   │
│ [Specific ▾] PersonA           │
│                                 │
│ Pizza × 1               ₱350   │
│ [Equal ▾] PersonA ✓ PersonB ✓  │
│                                 │
│ Drinks × 3              ₱150   │
│ [Equal ▾] All ✓                │
├─────────────────────────────────┤
│ PersonA  ₱345                  │  ← sticky running totals
│ PersonB  ₱225                  │
│ PersonC  ₱ 50                  │
│         [Confirm Items]         │
└─────────────────────────────────┘
```

**Props:** `{ visible, items, participants, currencySymbol, onConfirm, onCancel }`

#### c) `src/screens/bills/AskAIBillScreen.tsx` (NEW)

New full screen for **Ask AI** flow. Steps are sequential — each step unlocks the next.

```
┌──────────────────────────────────┐
│ ←  Ask AI to Create Bill         │
├──────────────────────────────────┤
│  Step 1: Upload Receipt          │
│  [📷 Tap to upload]              │
│  ┌────────────────────────────┐  │
│  │   receipt-preview.jpg      │  │
│  └────────────────────────────┘  │
│                                  │
│  Step 2: Who's included?         │  ← unlocked after receipt uploaded
│  [+ Add People]                  │
│  👤 John Santos  ×               │  ← selected from friends list
│  👤 Sarah Cruz   ×               │
│  👤 Mike Reyes   ×               │
│  💡 You are always included      │
│                                  │
│  Step 3: How to split?           │  ← unlocked after ≥1 participant
│  ┌────────────────────────────┐  │
│  │ John pays for the burger.  │  │
│  │ Sarah and Mike split the   │  │
│  │ pizza equally. Everyone    │  │
│  │ splits the drinks.         │  │
│  └────────────────────────────┘  │
│  💡 Names: John Santos,          │  ← hint shows selected participant names
│     Sarah Cruz, Mike Reyes, You  │
│                                  │
│       [🤖 Generate Bill]         │  ← enabled only when all 3 steps done
└──────────────────────────────────┘
```

**Key rules:**
- Participants selected from existing friends list (same picker as `CreateBillScreen`) — not free text
- You (payer) always auto-included, cannot be removed
- Prompt step disabled until ≥1 friend selected
- "Generate Bill" button disabled until receipt + participants + prompt all filled
- After AI responds → navigates to `AIBillReviewScreen`

#### d) `src/screens/bills/AIBillReviewScreen.tsx` (NEW)

Review screen shown after AI generates the bill. Lighter than `ReceiptItemsModal` — mainly confirm, with ability to adjust.

```
┌─────────────────────────────────┐
│ ← Review AI Bill                │
├─────────────────────────────────┤
│  Title: [Dinner at Jollibee]   │  ← editable
│  Category: [🍔 Food]            │  ← changeable
│  Date: [Mar 9, 2026]           │
│                                 │
│  Receipt Items                  │
│  Burger × 1    ₱120  PersonA   │  ← tappable to adjust
│  Pizza × 1     ₱350  PersonA,  │
│                       PersonB   │
│  Drinks × 3    ₱150  Everyone  │
│                                 │
│  Split Summary                  │
│  PersonA  ₱345                 │
│  PersonB  ₱225                 │
│  PersonC  ₱ 50                 │
│  Total    ₱620                 │
│                                 │
│      [✓ Confirm & Create]       │
└─────────────────────────────────┘
```

---

### 7. `src/screens/bills/CreateBillScreen.tsx` Updates

Changes are only for the **Scan Receipt** path. The main manual form stays unchanged.

- Add state: `receiptItems`, `showReceiptItemsModal`, `receiptScanLoading`
- Add "Upload Receipt" as attachment option (alongside existing "Add Photo")
- Show loading overlay during scan
- Open `ReceiptItemsModal` after scan completes
- After confirm: auto-fill total, set `splitMethod = 'item-based'`, hide split method selector
- Show collapsible "Receipt Items" summary with "Edit" button
- `handleCreateBill`: add `item-based` branch → `computeSplitsFromItems()`
- Edit mode: pre-populate `receiptItems` from `bill.receiptItems`

---

### 8. `src/screens/bills/BillDetailScreen.tsx` Updates

Add "Receipt Items" section between Split Details and Description (only when `bill.receiptItems` exists):

```
│ Split Details           │  ← existing
├─────────────────────────┤
│ Receipt Items      NEW  │
│  Burger × 1   ₱120     │
│  → PersonA              │
│  Pizza × 1    ₱350      │
│  → PersonA, PersonB     │
│  Drinks × 3   ₱150      │
│  → Everyone             │
├─────────────────────────┤
│ Description             │  ← existing
```

---

### 9. `src/services/supabaseApi.ts` Updates

- `createBill`: insert `bill_items` rows after bill insert (if `receiptItems` present)
- `updateBill`: delete old items + re-insert new ones
- `getBillById` / `getBills` / `getBillsByGroup`: fetch `bill_items` by `bill_id`, attach as `receiptItems`
- `getUserProfile` / `getUsersByIds`: include `email_notifications_enabled`
- Add `updateEmailNotificationPreference(userId, enabled)`
- `createActivity` + `createPokeActivity`: wire email (parallel, non-blocking)

---

### 10. `src/screens/profile/ProfileScreen.tsx` Updates

Add email notifications toggle in Settings section:

```
Settings
─────────────────────────────────────
Email Notifications     [toggle ON/OFF]
your@email.com
─────────────────────────────────────
Clear All Data
Delete Account
```

Uses `Switch` from React Native (no new library). Calls `supabaseApi.updateEmailNotificationPreference()` on toggle.

---

## Build Order

| # | What | File(s) | Notes |
|---|------|---------|-------|
| 1 | **Run migration** | Supabase SQL editor | Apply migration first before any code |
| 2 | **Update types** | `src/types/index.ts` | Foundation for everything else |
| 3 | **Deploy scan-receipt** | `supabase/functions/scan-receipt/` | Set `GEMINI_API_KEY` secret |
| 4 | **Deploy ai-create-bill** | `supabase/functions/ai-create-bill/` | Same `GEMINI_API_KEY` |
| 5 | **Deploy send-notification-email** | `supabase/functions/send-notification-email/` | Set `RESEND_API_KEY` secret |
| 6 | **Create emailService** | `src/services/emailService.ts` | Non-blocking wrapper |
| 7 | **Update supabaseApi** | `src/services/supabaseApi.ts` | bill_items CRUD + email prefs + wire email |
| 8 | **Update calculations** | `src/utils/calculations.ts` | Add `computeSplitsFromItems()` |
| 9 | **Create BillCreationPickerModal** | `src/components/BillCreationPickerModal.tsx` | Entry point picker |
| 10 | **Create ReceiptItemsModal** | `src/components/ReceiptItemsModal.tsx` | Manual item assignment |
| 11 | **Create AskAIBillScreen** | `src/screens/bills/AskAIBillScreen.tsx` | AI prompt + upload |
| 12 | **Create AIBillReviewScreen** | `src/screens/bills/AIBillReviewScreen.tsx` | Review AI result |
| 13 | **Update CreateBillScreen** | `src/screens/bills/CreateBillScreen.tsx` | Scan Receipt path only |
| 14 | **Update BillDetailScreen** | `src/screens/bills/BillDetailScreen.tsx` | Receipt Items section |
| 15 | **Update ProfileScreen** | `src/screens/profile/ProfileScreen.tsx` | Email toggle |
| 16 | **Update navigation** | `src/navigation/` | Register AskAIBillScreen + AIBillReviewScreen |

---

## Third-Party Setup Required

| Service | Purpose | Cost | Setup |
|---|---|---|---|
| **Google AI Studio** | Gemini Flash for receipt OCR + AI splitting | Free (1,500 req/day) | aistudio.google.com — no credit card |
| **Resend** | Email delivery | Free (3,000 emails/month) | resend.com — verify domain |

**Supabase secrets to set** (Dashboard → Edge Functions → Secrets):
- `GEMINI_API_KEY`
- `RESEND_API_KEY`

---

## Files Summary

| Status | File |
|--------|------|
| NEW | `database/migrations/add_bill_items_and_email_prefs.sql` |
| NEW | `supabase/functions/scan-receipt/index.ts` |
| NEW | `supabase/functions/ai-create-bill/index.ts` |
| NEW | `supabase/functions/send-notification-email/index.ts` |
| NEW | `src/services/emailService.ts` |
| NEW | `src/components/BillCreationPickerModal.tsx` |
| NEW | `src/components/ReceiptItemsModal.tsx` |
| NEW | `src/screens/bills/AskAIBillScreen.tsx` |
| NEW | `src/screens/bills/AIBillReviewScreen.tsx` |
| MODIFY | `src/types/index.ts` |
| MODIFY | `src/services/supabaseApi.ts` |
| MODIFY | `src/utils/calculations.ts` |
| MODIFY | `src/screens/bills/CreateBillScreen.tsx` |
| MODIFY | `src/screens/bills/BillDetailScreen.tsx` |
| MODIFY | `src/screens/profile/ProfileScreen.tsx` |
| MODIFY | `src/navigation/` (register new screens) |

**Total: 9 new files, 7 modified files**

---

## What Does NOT Change

- `notificationService.ts` — push notifications untouched
- `amot.bill_splits` — structure unchanged, still the payment record
- Existing manual bill creation flow — fully unchanged
- All existing split methods (equal, custom, percentage) — untouched
- `amot.bills` — no column added (items go in `bill_items` table)
