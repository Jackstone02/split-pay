-- amot_full_schema.sql
-- Complete schema for the amot (bill splitting) application
-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS amot;

-- Ensure pgcrypto (for gen_random_uuid) is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Table: amot.user_profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.user_profiles (
  id uuid PRIMARY KEY,
  display_name text,
  avatar_url text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  email text,
  payment_method text CHECK (payment_method = ANY (ARRAY['gcash'::text, 'paymaya'::text, NULL::text]))
);

ALTER TABLE IF EXISTS amot.user_profiles
  ADD CONSTRAINT IF NOT EXISTS user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.friends
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  status text DEFAULT 'accepted',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.friends
  ADD CONSTRAINT IF NOT EXISTS friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE IF EXISTS amot.friends
  ADD CONSTRAINT IF NOT EXISTS friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id);

-- RLS enabled on friends
ALTER TABLE IF EXISTS amot.friends ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Table: amot.groups
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.groups
  ADD CONSTRAINT IF NOT EXISTS groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.group_members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.group_members
  ADD CONSTRAINT IF NOT EXISTS group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES amot.groups(id);
ALTER TABLE IF EXISTS amot.group_members
  ADD CONSTRAINT IF NOT EXISTS group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.bills
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  total_amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  paid_by uuid,
  group_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  settled boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.bills
  ADD CONSTRAINT IF NOT EXISTS bills_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES auth.users(id);
ALTER TABLE IF EXISTS amot.bills
  ADD CONSTRAINT IF NOT EXISTS bills_group_id_fkey FOREIGN KEY (group_id) REFERENCES amot.groups(id);
ALTER TABLE IF EXISTS amot.bills
  ADD CONSTRAINT IF NOT EXISTS bills_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.bill_splits
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.bill_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  share_type text DEFAULT 'equal',
  percent numeric,
  settled boolean DEFAULT false,
  settled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.bill_splits
  ADD CONSTRAINT IF NOT EXISTS bill_splits_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES amot.bills(id);
ALTER TABLE IF EXISTS amot.bill_splits
  ADD CONSTRAINT IF NOT EXISTS bill_splits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  payment_method text,
  note text,
  created_at timestamptz DEFAULT now(),
  external_reference text
);

ALTER TABLE IF EXISTS amot.payments
  ADD CONSTRAINT IF NOT EXISTS payments_from_user_fkey FOREIGN KEY (from_user) REFERENCES auth.users(id);
ALTER TABLE IF EXISTS amot.payments
  ADD CONSTRAINT IF NOT EXISTS payments_to_user_fkey FOREIGN KEY (to_user) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.activity
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.activity
  ADD CONSTRAINT IF NOT EXISTS activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.user_balances
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.user_balances (
  user_id uuid PRIMARY KEY,
  balance numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.user_balances
  ADD CONSTRAINT IF NOT EXISTS user_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- -----------------------------------------------------------------------------
-- Table: amot.push_tokens
-- Store device push notification tokens for Expo Push Notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_id text NOT NULL,
  platform text CHECK (platform IN ('ios','android','web')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.push_tokens
  ADD CONSTRAINT IF NOT EXISTS push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE IF EXISTS amot.push_tokens ENABLE ROW LEVEL SECURITY;

-- Indexes for push_tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_device ON amot.push_tokens(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON amot.push_tokens(user_id);

-- Policies for amot.push_tokens
CREATE POLICY IF NOT EXISTS push_tokens_user_insert ON amot.push_tokens
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid())::uuid = user_id);

CREATE POLICY IF NOT EXISTS push_tokens_user_select ON amot.push_tokens
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid())::uuid = user_id);

CREATE POLICY IF NOT EXISTS push_tokens_user_update ON amot.push_tokens
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid())::uuid = user_id)
  WITH CHECK ((SELECT auth.uid())::uuid = user_id);

CREATE POLICY IF NOT EXISTS push_tokens_user_delete ON amot.push_tokens
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid())::uuid = user_id);

-- Grant permissions for push_tokens
GRANT SELECT, INSERT, UPDATE, DELETE ON amot.push_tokens TO authenticated;

-- -----------------------------------------------------------------------------
-- Table: amot.poke_history
-- Store history of poke reminders sent between users about payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amot.poke_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bill_id uuid REFERENCES amot.bills(id) ON DELETE SET NULL,
  amount numeric,
  message text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS amot.poke_history ENABLE ROW LEVEL SECURITY;

-- Indexes for poke_history
CREATE INDEX IF NOT EXISTS idx_poke_history_to_user ON amot.poke_history(to_user_id);
CREATE INDEX IF NOT EXISTS idx_poke_history_from_user ON amot.poke_history(from_user_id);
CREATE INDEX IF NOT EXISTS idx_poke_history_bill ON amot.poke_history(bill_id);
CREATE INDEX IF NOT EXISTS idx_poke_history_created_at ON amot.poke_history(created_at);

-- Policies for amot.poke_history
CREATE POLICY IF NOT EXISTS poke_history_insert ON amot.poke_history
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid())::uuid = from_user_id);

CREATE POLICY IF NOT EXISTS poke_history_select_to ON amot.poke_history
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid())::uuid = to_user_id
    OR (SELECT auth.uid())::uuid = from_user_id
  );

CREATE POLICY IF NOT EXISTS poke_history_update_read ON amot.poke_history
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid())::uuid = to_user_id
    OR (SELECT auth.uid())::uuid = from_user_id
  )
  WITH CHECK (true);

-- Foreign key constraints for poke_history
ALTER TABLE IF EXISTS amot.poke_history
  ADD CONSTRAINT IF NOT EXISTS poke_history_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES amot.bills(id);
ALTER TABLE IF EXISTS amot.poke_history
  ADD CONSTRAINT IF NOT EXISTS poke_history_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id);
ALTER TABLE IF EXISTS amot.poke_history
  ADD CONSTRAINT IF NOT EXISTS poke_history_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id);

-- Grant permissions for poke_history
GRANT SELECT, INSERT, UPDATE ON amot.poke_history TO authenticated;

-- -----------------------------------------------------------------------------
-- Functions & Triggers
-- -----------------------------------------------------------------------------

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION amot.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach updated_at trigger to tables that have updated_at column
DROP TRIGGER IF EXISTS trg_push_tokens_updated_at ON amot.push_tokens;
CREATE TRIGGER trg_push_tokens_updated_at
  BEFORE UPDATE ON amot.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION amot.set_updated_at();

DROP TRIGGER IF EXISTS trg_bills_updated_at ON amot.bills;
CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON amot.bills
  FOR EACH ROW
  EXECUTE FUNCTION amot.set_updated_at();

DROP TRIGGER IF EXISTS trg_bill_splits_updated_at ON amot.bill_splits;
CREATE TRIGGER trg_bill_splits_updated_at
  BEFORE UPDATE ON amot.bill_splits
  FOR EACH ROW
  EXECUTE FUNCTION amot.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON amot.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON amot.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION amot.set_updated_at();

DROP TRIGGER IF EXISTS trg_friends_updated_at ON amot.friends;
CREATE TRIGGER trg_friends_updated_at
  BEFORE UPDATE ON amot.friends
  FOR EACH ROW
  EXECUTE FUNCTION amot.set_updated_at();

DROP TRIGGER IF EXISTS trg_groups_updated_at ON amot.groups;
CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON amot.groups
  FOR EACH ROW
  EXECUTE FUNCTION amot.set_updated_at();

-- -----------------------------------------------------------------------------
-- Add color and category columns to groups table
-- -----------------------------------------------------------------------------
ALTER TABLE amot.groups
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT
    CHECK (category IN ('trip', 'roommates', 'event', 'other'));

-- Set default category for existing records
UPDATE amot.groups
SET category = 'other'
WHERE category IS NULL;

-- -----------------------------------------------------------------------------
-- Add category column to bills table
-- -----------------------------------------------------------------------------
ALTER TABLE amot.bills
  ADD COLUMN IF NOT EXISTS category TEXT
    CHECK (category IN ('food', 'transport', 'utilities', 'entertainment', 'shopping', 'other'));

-- Set default category for existing bills
UPDATE amot.bills
SET category = 'other'
WHERE category IS NULL;

-- -----------------------------------------------------------------------------
-- Optional: Push Notification Queue
-- Uncomment if you want to process push notifications via an Edge Function
-- -----------------------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS amot.push_queue (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   poke_id uuid REFERENCES amot.poke_history(id) ON DELETE CASCADE,
--   processed boolean DEFAULT false,
--   created_at timestamptz DEFAULT now(),
--   processed_at timestamptz
-- );
-- CREATE INDEX IF NOT EXISTS idx_push_queue_processed_created ON amot.push_queue (processed, created_at);

-- CREATE OR REPLACE FUNCTION amot.notify_on_poke()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   INSERT INTO amot.push_queue (poke_id, created_at) VALUES (NEW.id, now());
--   RETURN NEW;
-- END;
-- $$;

-- DROP TRIGGER IF EXISTS trg_poke_history_notify ON amot.poke_history;
-- CREATE TRIGGER trg_poke_history_notify
--   AFTER INSERT ON amot.poke_history
--   FOR EACH ROW
--   EXECUTE FUNCTION amot.notify_on_poke();

-- -----------------------------------------------------------------------------
-- Migration: Add Payment Confirmation Status to bill_splits
-- Description: Adds payment_status and marked_paid_at columns to support
-- the pending confirmation workflow for payments
-- -----------------------------------------------------------------------------

-- Add payment_status column with enum type
-- Options: 'unpaid', 'pending_confirmation', 'confirmed'
ALTER TABLE amot.bill_splits
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
CHECK (payment_status IN ('unpaid', 'pending_confirmation', 'confirmed'));

-- Add marked_paid_at column to track when user marked payment as paid
ALTER TABLE amot.bill_splits
ADD COLUMN IF NOT EXISTS marked_paid_at TIMESTAMPTZ;

-- Create index for faster queries on payment_status
CREATE INDEX IF NOT EXISTS idx_bill_splits_payment_status ON amot.bill_splits(payment_status);

-- Update existing records:
-- If settled = true, set payment_status to 'confirmed' and use settled_at as marked_paid_at
UPDATE amot.bill_splits
SET
  payment_status = CASE
    WHEN settled = true THEN 'confirmed'
    ELSE 'unpaid'
  END,
  marked_paid_at = CASE
    WHEN settled = true THEN settled_at
    ELSE NULL
  END
WHERE payment_status IS NULL OR payment_status = 'unpaid';

-- Add comments to explain the workflow
COMMENT ON COLUMN amot.bill_splits.payment_status IS 'Payment confirmation status: unpaid -> pending_confirmation -> confirmed';
COMMENT ON COLUMN amot.bill_splits.marked_paid_at IS 'Timestamp when user marked payment as paid (pending confirmation)';

-- Create a trigger to auto-update settled when payment_status = 'confirmed'
-- This keeps backward compatibility with existing code that checks the settled field
CREATE OR REPLACE FUNCTION amot.sync_payment_status_to_settled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'confirmed' THEN
    NEW.settled = true;
    IF NEW.settled_at IS NULL THEN
      NEW.settled_at = NOW();
    END IF;
  ELSIF NEW.payment_status IN ('unpaid', 'pending_confirmation') THEN
    NEW.settled = false;
    NEW.settled_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_payment_status_to_settled_trigger ON amot.bill_splits;
CREATE TRIGGER sync_payment_status_to_settled_trigger
BEFORE INSERT OR UPDATE OF payment_status ON amot.bill_splits
FOR EACH ROW
EXECUTE FUNCTION amot.sync_payment_status_to_settled();

-- -----------------------------------------------------------------------------
-- End of amot schema
-- -----------------------------------------------------------------------------
