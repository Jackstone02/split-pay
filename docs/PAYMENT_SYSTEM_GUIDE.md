# Payment System Guide

This app uses a simplified manual payment system with helpful UI for GCash and Maya payments.

## How It Works

### Payment Flow

1. **User views balance** in FriendsScreen
2. **Taps "Pay"** button next to a friend they owe money to
3. **Views payment screen** showing:
   - Friend's name and GCash/Maya phone number (with copy button)
   - Amount to pay
   - Payment method options
4. **Selects payment method:**
   - **GCash** - Opens GCash app (user manually enters amount & recipient)
   - **Maya** - Opens Maya app (user manually enters amount & recipient)
   - **Mark as Paid** - For payments made outside the app
5. **If using GCash/Maya:**
   - Copies phone number from payment screen
   - Opens the e-wallet app
   - Manually enters the amount and recipient phone number
   - Completes payment in the app
6. **Returns to app** and confirms the payment
7. **Enters reference number** (optional) from the receipt
8. **Payment recorded** in the app

### Architecture

```
FriendsScreen (shows balance)
    ↓
PaymentScreen (select method)
    ↓
Deep Link → Opens GCash/Maya app
    ↓
User completes payment
    ↓
Returns to PaymentScreen
    ↓
Confirmation screen (with reference number input)
    ↓
Payment saved to database
```

## Deep Linking (Simplified Approach)

### What is Deep Linking?

Deep linking allows your app to open other apps. In this implementation, we simply open the GCash or Maya app without passing parameters, since auto-filling requires official API integration.

### Deep Link Format

```javascript
// GCash - Simple open
gcash://

// Maya (PayMaya) - Simple open
paymaya://
```

### Why Not Auto-Fill?

Auto-filling payment details (amount and recipient) requires:
1. Official partnership with GCash/Maya
2. API keys and authentication
3. Payment gateway fees
4. Complex backend integration

For a friend/family bill-splitting app, the manual approach is simpler and sufficient.

### How It Works

1. **App must be installed** - Deep linking only works if the user has GCash or Maya installed
2. **Opens app** - Simply launches the e-wallet app's home screen
3. **User manually enters:**
   - Recipient's phone number (shown in the payment screen with copy button)
   - Amount to pay (clearly displayed in the payment screen)
4. **Fallback handling** - If app not installed, shows link to Play Store/App Store

### User-Friendly Features

- **Phone Number Display**: Friend's GCash/Maya number is prominently displayed
- **Copy to Clipboard**: Tap the phone number to copy it instantly
- **Amount Reference**: Amount is shown clearly for manual entry
- **Step-by-Step Instructions**: Clear guidance on what to do

## Database Schema

### payment_transactions Table

```sql
payment_transactions (
  id                      UUID (primary key)
  from_user_id            UUID (who's paying)
  to_user_id              UUID (who's receiving)
  bill_id                 UUID (optional, if linked to a bill)
  amount                  DECIMAL
  payment_method          VARCHAR (gcash, paymaya, manual)
  gateway_provider        VARCHAR (NULL for deep linking)
  gateway_transaction_id  VARCHAR (reference number from receipt)
  status                  VARCHAR (pending, completed, failed)
  description             TEXT
  metadata                JSONB (additional info)
  created_at              TIMESTAMP
  completed_at            TIMESTAMP
)
```

### Automatic Bill Settlement

When a payment is marked as completed, the corresponding `bill_splits` are automatically marked as `settled`:

```sql
-- Trigger automatically updates bill_splits when payment completes
UPDATE bill_splits
SET settled = true, settled_at = NOW()
WHERE bill_id = payment.bill_id
  AND user_id = payment.from_user_id;
```

## Alternative: Using Official APIs

If you need automated payment verification instead of manual confirmation, consider using official payment gateway APIs:

### Option 1: GCash Official API
- Requires partnership with GCash
- Contact: https://www.gcash.com/business
- Provides automated payment confirmation
- Higher fees but more secure

### Option 2: PayMongo (Recommended)
- Easiest for developers
- Supports GCash, Maya, Cards
- Automated webhooks
- See `PAYMONGO_INTEGRATION_GUIDE.md` for details

### Option 3: Xendit
- Similar to PayMongo
- Good documentation
- Multiple payment methods

## Testing

### Test the Deep Linking

1. **Install GCash/Maya** on your test device
2. **Run the app** in development mode
3. **Navigate to Friends** screen
4. **Tap Pay** on a friend you owe money to
5. **Select GCash or Maya**
6. **Verify** the app opens (may show error if deep link format is incorrect)

### Test the Manual Flow

1. **Select "Mark as Paid"** option
2. **Enter a reference number** (test: "REF123456")
3. **Confirm payment**
4. **Check database** to verify payment is recorded

### Database Testing

Run the migration first:

```bash
# Connect to your Supabase database and run:
psql -f database/migrations/create_payment_transactions.sql
```

Verify the table was created:

```sql
SELECT * FROM amot.payment_transactions;
```

## Security Considerations

### Current Implementation (Manual Confirmation)

✅ **Pros:**
- Simple to implement
- No payment gateway fees
- Users can use any payment method
- Works offline (payment can be made via cash/bank)

⚠️ **Cons:**
- Relies on user honesty
- No automatic verification
- Possible disputes

**Best for:** Friends/family expense splitting, trusted groups

### Recommended for Production

If you're building this for public use with untrusted users, consider:

1. **Payment Gateway Integration** - Automated verification
2. **Dispute Resolution** - Allow users to contest payments
3. **Receipt Upload** - Let users upload payment screenshots
4. **Escrow System** - Hold payments until confirmed by recipient

## Customization

### Adding More Payment Methods

You can easily add more payment methods to `PaymentScreen.tsx`:

```typescript
{
  id: 'coins' as PaymentMethod,
  name: 'Coins.ph',
  icon: 'wallet',
  color: '#FF9500',
  description: 'Opens Coins.ph app to complete payment',
  enabled: true,
},
```

### Changing Deep Link URLs

Update the `processOnlinePayment` function:

```typescript
if (method === 'gcash') {
  // Replace with official GCash deep link format
  deepLinkUrl = `gcash://send?mobile=${recipientMobile}&amount=${amount}`;
  appName = 'GCash';
}
```

### Adding Payment Notifications

You can extend the system to send notifications:

```typescript
// In handleConfirmPayment, after saving payment:
await sendNotificationToUser(toUserId, {
  title: 'Payment Received',
  body: `${user.name} paid you ₱${amount.toFixed(2)}`,
});
```

## Next Steps

- [ ] Test GCash deep linking on actual device
- [ ] Test Maya deep linking on actual device
- [ ] Get official deep link formats from GCash/Maya
- [ ] Add payment history screen
- [ ] Add receipt/screenshot upload feature
- [ ] Implement dispute resolution
- [ ] Add payment reminders

## Support

For GCash deep linking:
- Email: merchantsupport@gcash.com

For Maya deep linking:
- Email: developer@paymaya.com
- Portal: https://developers.maya.ph

## FAQ

**Q: Why doesn't the app auto-fill the amount and recipient in GCash/Maya?**
A: Auto-filling requires official API integration with GCash/Maya, which involves:
- Partnership agreements
- API keys and authentication
- Payment gateway fees (typically 2-3% per transaction)
- Complex backend infrastructure

For a friend/family bill-splitting app, the simplified manual approach is more practical and has no fees.

**Q: Can users fake payments?**
A: Yes, with the manual confirmation approach, users can mark payments as paid without actually paying. This is acceptable for friend/family groups built on trust but not recommended for public/commercial use with untrusted users.

**Q: How do I verify payments automatically?**
A: You would need to integrate with a payment gateway like PayMongo or Xendit. See `PAYMONGO_INTEGRATION_GUIDE.md` for details. However, this adds complexity and transaction fees.

**Q: What if my friend doesn't have a phone number in their profile?**
A: The payment screen will show a warning. Users can still proceed with the payment but will need to ask their friend for their GCash/Maya number directly.

**Q: Can I accept credit cards?**
A: Not with this simplified approach. You'll need to integrate with a payment gateway that supports card payments.
