-- ============================================================
-- CyberCheck Platform — RLS Fix for Signup Flow
-- Run this in Supabase SQL Editor AFTER 01-tables.sql and 02-security.sql
--
-- PROBLEM: During signup, the user has just been created in auth.users
-- but no record exists yet in public.users, so get_site_id() returns NULL.
-- This means RLS blocks all INSERTs into businesses, users, and site_content.
--
-- FIX: Add INSERT policies that allow authenticated users to create
-- their initial records during the signup flow.
-- ============================================================

-- Allow authenticated users to INSERT a new business during signup
-- (Only needs auth — any logged-in user can create ONE business)
CREATE POLICY "signup_insert_business" ON businesses
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to INSERT their own user record
-- (auth_id must match their Supabase Auth ID — can't create records for others)
CREATE POLICY "signup_insert_user" ON users
    FOR INSERT WITH CHECK (auth_id = auth.uid());

-- Allow authenticated users to INSERT site_content for a business they own
-- (After the users record exists, get_site_id() works, so the existing
-- FOR ALL policy handles this. But as a safety net:)
CREATE POLICY "signup_insert_site_content" ON site_content
    FOR INSERT WITH CHECK (
        site_id IN (SELECT u.site_id FROM public.users u WHERE u.auth_id = auth.uid())
    );

-- NOTE: If you're using the backend API for signup (recommended),
-- the service key bypasses RLS entirely, so these policies are only
-- needed if users sign up directly through the frontend Supabase client.
