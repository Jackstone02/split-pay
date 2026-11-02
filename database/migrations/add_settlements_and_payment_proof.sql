-- =====================================================
-- Settlements (combined "net" payments) + payment proof
-- =====================================================
-- Run this in the Supabase SQL editor BEFORE shipping the app version
-- that uses it (the app selects these columns when loading bills).
-- Safe to run more than once. Older app versions ignore the new columns.

-- settlement_id groups every split covered by one combined payment:
--   * the payer's splits that were marked as paid (pending_confirmation)
--   * the receiver's splits on the payer's bills that the net payment cancels out
-- When the receiver confirms, all splits with that settlement_id are settled together.
ALTER TABLE amot.bill_splits
  ADD COLUMN IF NOT EXISTS settlement_id uuid;

-- Public URL of the screenshot/receipt the payer attached as proof of payment.
ALTER TABLE amot.bill_splits
  ADD COLUMN IF NOT EXISTS proof_url text;

CREATE INDEX IF NOT EXISTS idx_bill_splits_settlement_id
  ON amot.bill_splits(settlement_id);

COMMENT ON COLUMN amot.bill_splits.settlement_id IS 'Groups splits settled by one combined net payment';
COMMENT ON COLUMN amot.bill_splits.proof_url IS 'Proof of payment image uploaded by the payer';

-- Keep the payment history record in sync (optional tracking table).
ALTER TABLE amot.payments
  ADD COLUMN IF NOT EXISTS settlement_id uuid;

ALTER TABLE amot.payments
  ADD COLUMN IF NOT EXISTS proof_url text;
