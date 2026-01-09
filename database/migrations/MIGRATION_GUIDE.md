# Bidirectional Friendship Migration Guide

## Overview

This migration converts existing one-way friendships to bidirectional friendships. After running this migration, when User A adds User B as a friend, both users will automatically see each other in their friends lists.

## Prerequisites

Before running the migration:
1. ✅ Deploy the updated code with bidirectional friendship changes
2. ✅ Backup your database (recommended)
3. ✅ Test in a staging environment first (recommended)

## Migration Options

You have two options to run this migration:

---

### Option 1: SQL Script (Recommended)

**Best for:** Direct database access via Supabase dashboard or psql

**Steps:**
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file: `database/migrations/migrate_bidirectional_friendships.sql`
4. Copy and paste the entire SQL script
5. Click **Run** to execute

**Expected Output:**
```
NOTICE:  Migration Complete: X reverse friendship entries created
```

---

### Option 2: TypeScript Script

**Best for:** Running from your development environment

**Steps:**

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Run the migration script**:
   ```bash
   npx ts-node database/migrations/migrateBidirectionalFriendships.ts
   ```

**Expected Output:**
```
🔄 Starting bidirectional friendship migration...

📊 Step 1: Fetching existing friendships...
   Found 50 friendship entries

🔍 Step 2: Identifying friendships needing reverse entries...
   Found 25 friendships needing reverse entries

➕ Step 3: Creating reverse friendship entries...
   ✅ Successfully created 25 reverse entries

✔️  Step 4: Verifying migration...
   ✅ All friendships are now bidirectional!

📊 Migration Summary:
   - Original friendships: 50
   - Reverse entries created: 25
   - Total friendships now: 75
   - Orphaned friendships: 0

✅ Migration completed successfully!

🎉 Done!
```

---

## What This Migration Does

1. **Identifies one-way friendships**: Finds all friendship entries that don't have a reverse entry
2. **Creates reverse entries**: For each one-way friendship, creates the opposite direction
3. **Preserves timestamps**: Keeps the original `created_at` and `updated_at` timestamps
4. **Verifies completion**: Checks that all friendships are now bidirectional

## Example

**Before Migration:**
```
| id | user_id | friend_id | status   |
|----|---------|-----------|----------|
| 1  | alice   | bob       | accepted |
| 2  | charlie | alice     | accepted |
```
- Alice sees Bob in her friends list ✓
- Bob does NOT see Alice ✗
- Charlie sees Alice ✓
- Alice does NOT see Charlie ✗

**After Migration:**
```
| id | user_id | friend_id | status   |
|----|---------|-----------|----------|
| 1  | alice   | bob       | accepted |
| 2  | charlie | alice     | accepted |
| 3  | bob     | alice     | accepted | ← NEW
| 4  | alice   | charlie   | accepted | ← NEW
```
- Alice sees Bob ✓ and Bob sees Alice ✓
- Charlie sees Alice ✓ and Alice sees Charlie ✓

## Verification

After running the migration, verify the results:

### Check Total Friendships
```sql
SELECT COUNT(*) as total_friendships
FROM amot.friends;
```

### Check for Orphaned Friendships (should return 0)
```sql
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
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- WARNING: This will remove all bidirectional friendships
-- Only run if you backed up your data first

-- Delete friendships created after the migration timestamp
DELETE FROM amot.friends
WHERE created_at > '[your_migration_timestamp]';
```

**Better approach:** Restore from your database backup taken before migration.

## Notes

- ⚠️ This migration is **idempotent** - you can run it multiple times safely
- ⚠️ If a reverse friendship already exists, it won't create a duplicate
- ⚠️ The migration does NOT delete any existing data
- ✅ All friendship activity history is preserved
- ✅ Users will not receive duplicate notifications

## Troubleshooting

### "Failed to fetch friendships"
- Check your Supabase connection in `src/services/supabase.ts`
- Verify your Supabase credentials are correct

### "Failed to insert reverse friendships"
- Check for database constraints or permissions issues
- Verify the `amot.friends` table exists and is accessible

### Migration shows 0 friendships
- This is normal if your database has no existing friendships
- New friendships will automatically be bidirectional going forward

## Support

If you encounter issues:
1. Check the migration logs for specific error messages
2. Verify your database schema matches the expected structure
3. Ensure you have proper permissions on the `amot.friends` table
