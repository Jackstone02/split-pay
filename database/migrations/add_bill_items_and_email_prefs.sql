-- ============================================================
-- Migration: add_bill_items_and_email_prefs
-- Safe to run on production — additive only, no existing data touched
-- ============================================================

-- 1. Create bill_items table (only if it doesn't already exist)
CREATE TABLE IF NOT EXISTS amot.bill_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id       uuid        NOT NULL REFERENCES amot.bills(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  quantity      numeric     NOT NULL DEFAULT 1,
  unit_price    numeric     NOT NULL,
  total_price   numeric     NOT NULL,
  assigned_to   uuid[]      NOT NULL DEFAULT '{}',
  split_method  text        NOT NULL DEFAULT 'equal'
                            CHECK (split_method IN ('specific', 'equal', 'percentage')),
  percentages   jsonb       DEFAULT NULL,
  created_at    timestamptz DEFAULT now()
);

-- Index for fast lookups by bill
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON amot.bill_items(bill_id);

-- 2. RLS policies for bill_items
ALTER TABLE amot.bill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_items_select" ON amot.bill_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM amot.bill_splits
    WHERE bill_splits.bill_id = bill_items.bill_id
      AND bill_splits.user_id = auth.uid()
  )
);

CREATE POLICY "bill_items_insert" ON amot.bill_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM amot.bills
    WHERE bills.id = bill_items.bill_id
      AND bills.paid_by = auth.uid()
  )
);

CREATE POLICY "bill_items_delete" ON amot.bill_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM amot.bills
    WHERE bills.id = bill_items.bill_id
      AND bills.paid_by = auth.uid()
  )
);

-- 3. Add email_notifications_enabled to user_profiles (only if column doesn't exist)
--    Default TRUE so existing users keep receiving emails unless they opt out
ALTER TABLE amot.user_profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true;
