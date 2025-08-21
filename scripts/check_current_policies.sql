-- Check current RLS policies without creating duplicates
-- This script shows what policies already exist

-- Show all policies for the photos table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'photos'
ORDER BY policyname;

-- Show all policies for all tables to verify complete setup
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('users', 'reminders', 'photos')
ORDER BY tablename, policyname;

-- Check if the photos table has the required policies
SELECT
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(cmd, ', ') as operations
FROM pg_policies
WHERE tablename = 'photos'
GROUP BY tablename;
