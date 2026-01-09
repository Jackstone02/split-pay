-- Migration: Convert Unidirectional Friendships to Bidirectional
-- Description: This migration converts existing one-way friendships to bidirectional
-- by creating the reverse friendship entries where they don't exist.
-- Run this ONCE after deploying the bidirectional friendship code changes.

-- Step 1: Create a temporary table to track friendships that need reverse entries
CREATE TEMP TABLE IF NOT EXISTS friendships_to_mirror AS
SELECT
  f.id,
  f.user_id,
  f.friend_id,
  f.status,
  f.created_at,
  f.updated_at
FROM amot.friends f
WHERE NOT EXISTS (
  -- Check if reverse friendship already exists
  SELECT 1
  FROM amot.friends f2
  WHERE f2.user_id = f.friend_id
    AND f2.friend_id = f.user_id
    AND f2.status = f.status
);

-- Step 2: Insert the reverse friendships
INSERT INTO amot.friends (user_id, friend_id, status, created_at, updated_at)
SELECT
  friend_id,      -- Swap: friend becomes user
  user_id,        -- Swap: user becomes friend
  status,
  created_at,     -- Keep same created timestamp
  updated_at      -- Keep same updated timestamp
FROM friendships_to_mirror;

-- Step 3: Show summary of migration
DO $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  RAISE NOTICE 'Migration Complete: % reverse friendship entries created', rows_inserted;
END $$;

-- Step 4: Verify the migration (optional check query)
-- Uncomment to see the results:
/*
SELECT
  COUNT(*) as total_friendships,
  COUNT(DISTINCT user_id) as unique_users
FROM amot.friends;
*/

-- Step 5: Check for any orphaned one-way friendships (should be 0 after migration)
-- Uncomment to verify:
/*
SELECT
  f.id,
  f.user_id,
  f.friend_id,
  'Missing reverse entry' as issue
FROM amot.friends f
WHERE NOT EXISTS (
  SELECT 1
  FROM amot.friends f2
  WHERE f2.user_id = f.friend_id
    AND f2.friend_id = f.user_id
);
*/
