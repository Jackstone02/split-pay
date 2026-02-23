-- AMOT Features Migration
-- Adds: bank_transfer payment method, preferred_currency, location on bill,
--       bill_date, attachment_url, and Supabase Storage buckets for avatars/attachments.
-- Run this against an existing database that already has the base schema applied.

-- ============================================================
-- Feature 2: Expand payment_method constraint to include bank_transfer
-- ============================================================
ALTER TABLE amot.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_payment_method_check;
ALTER TABLE amot.user_profiles ADD CONSTRAINT user_profiles_payment_method_check
  CHECK (payment_method = ANY (ARRAY['gcash'::text, 'paymaya'::text, 'bank_transfer'::text, NULL]));

-- ============================================================
-- Feature 3: Global currency preference
-- ============================================================
ALTER TABLE amot.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'PHP';

-- ============================================================
-- Feature 4: Location on bill
-- ============================================================
ALTER TABLE amot.bills ADD COLUMN IF NOT EXISTS location TEXT;

-- ============================================================
-- Feature 5: Bill date (separate from created_at)
-- ============================================================
ALTER TABLE amot.bills ADD COLUMN IF NOT EXISTS bill_date TIMESTAMPTZ;

-- ============================================================
-- Feature 6: Photo attachment on bill
-- ============================================================
ALTER TABLE amot.bills ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- ============================================================
-- Feature 7: Supabase Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('bill-attachments', 'bill-attachments', true)
  ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS Policies — Avatars bucket
-- ============================================================
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
CREATE POLICY "Anyone can read avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- ============================================================
-- RLS Policies — Bill attachments bucket
-- ============================================================
DROP POLICY IF EXISTS "Users can upload their own bill attachments" ON storage.objects;
CREATE POLICY "Users can upload their own bill attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bill-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own bill attachments" ON storage.objects;
CREATE POLICY "Users can update their own bill attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bill-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone can read bill attachments" ON storage.objects;
CREATE POLICY "Anyone can read bill attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'bill-attachments');
