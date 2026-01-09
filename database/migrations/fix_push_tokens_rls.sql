-- Fix Push Tokens RLS Policy
-- Allow users to read push tokens of their friends (needed for poke notifications)

-- Drop the old restrictive policy
DROP POLICY IF EXISTS push_tokens_user_select ON amot.push_tokens;

-- Create new policy that allows:
-- 1. Users to read their own push tokens
-- 2. Users to read push tokens of their friends
CREATE POLICY push_tokens_select_own_and_friends ON amot.push_tokens
  FOR SELECT TO authenticated
  USING (
    -- Can read own tokens
    (SELECT auth.uid())::uuid = user_id
    OR
    -- Can read friends' tokens (bidirectional friendship check)
    EXISTS (
      SELECT 1 FROM amot.friends
      WHERE status = 'accepted'
        AND (
          (user_id = (SELECT auth.uid())::uuid AND friend_id = push_tokens.user_id)
          OR
          (friend_id = (SELECT auth.uid())::uuid AND user_id = push_tokens.user_id)
        )
    )
  );
