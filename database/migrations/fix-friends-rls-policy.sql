-- Fix RLS policies for friends table to allow bidirectional friendship management
-- Run this in Supabase SQL Editor

-- ===== INSERT POLICY =====
-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Users can insert their own friendships" ON amot.friends;
DROP POLICY IF EXISTS "Users can insert friendships" ON amot.friends;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON amot.friends;

-- Create new INSERT policy that allows both directions
-- This allows a user to create friendship rows where:
-- 1. They are the user_id (adding someone as a friend)
-- 2. They are the friend_id (being added as a friend by someone else)
CREATE POLICY "Users can create bidirectional friendships"
ON amot.friends
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- ===== DELETE POLICY =====
-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Users can delete their own friendships" ON amot.friends;
DROP POLICY IF EXISTS "Users can delete friendships" ON amot.friends;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON amot.friends;

-- Create new DELETE policy that allows both directions
-- This allows a user to delete friendship rows where:
-- 1. They are the user_id (removing someone from their friends)
-- 2. They are the friend_id (being removed as a friend by someone else)
CREATE POLICY "Users can delete bidirectional friendships"
ON amot.friends
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- ===== SELECT POLICY =====
-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own friendships" ON amot.friends;
DROP POLICY IF EXISTS "Users can view friendships" ON amot.friends;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON amot.friends;

-- Create new SELECT policy
CREATE POLICY "Users can view their friendships"
ON amot.friends
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- ===== UPDATE POLICY =====
-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update their own friendships" ON amot.friends;
DROP POLICY IF EXISTS "Users can update friendships" ON amot.friends;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON amot.friends;

-- Create new UPDATE policy
CREATE POLICY "Users can update their friendships"
ON amot.friends
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id OR auth.uid() = friend_id
)
WITH CHECK (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- Verify all policies were created
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'friends'
  AND policyname IN (
    'Users can create bidirectional friendships',
    'Users can delete bidirectional friendships',
    'Users can view their friendships',
    'Users can update their friendships'
  )
ORDER BY cmd;
