-- Fix RLS Policies for photos table
-- This script adds the missing INSERT policy that allows users to upload photos

-- Add the missing INSERT policy for photos table
CREATE POLICY "Users can insert own photos" ON public.photos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Verify the policy was created
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
WHERE tablename = 'photos' AND policyname = 'Users can insert own photos';

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
