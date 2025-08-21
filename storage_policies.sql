-- Storage Policies for Photo Check App
-- IMPORTANT: You cannot run these directly in SQL Editor due to permissions
-- Use the Supabase Dashboard instead!

-- ========================================
-- METHOD 1: Use Supabase Dashboard (Recommended)
-- ========================================

-- 1. Go to Supabase Dashboard → Storage → Buckets
-- 2. Click on your 'photos' bucket
-- 3. Click "New Policy" button
-- 4. Use the policy generator with these settings:

-- Policy Name: "Allow authenticated uploads"
-- Target roles: authenticated
-- Using expression: bucket_id = 'photos'

-- Policy Name: "Allow users to view own photos"
-- Target roles: authenticated
-- Using expression: bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]

-- ========================================
-- METHOD 2: Quick Fix - Make Bucket Public
-- ========================================

-- 1. Go to Storage → Buckets
-- 2. Click on 'photos' bucket
-- 3. Toggle "Public bucket" to ON
-- 4. Save changes

-- ========================================
-- METHOD 3: Check Current Policies
-- ========================================

-- You can run this to see existing policies:
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
WHERE tablename = 'objects'
AND schemaname = 'storage';

-- ========================================
-- METHOD 4: Use Supabase CLI (Advanced)
-- ========================================

-- If you have Supabase CLI installed:
-- 1. supabase login
-- 2. supabase link --project-ref YOUR_PROJECT_ID
-- 3. Create a migration file with the policies
-- 4. supabase db push

-- ========================================
-- RECOMMENDED APPROACH FOR TESTING
-- ========================================

-- For now, just make the bucket public:
-- 1. Go to Storage → Buckets → photos
-- 2. Toggle "Public bucket" to ON
-- 3. Test your photo upload
-- 4. Add proper policies later for production
