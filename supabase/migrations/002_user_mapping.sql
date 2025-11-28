-- ===========================================
-- USER MAPPING MIGRATION
-- Creates users table to map Auth0 IDs to internal UUIDs
-- ===========================================

-- ===========================================
-- DROP DEPENDENT OBJECTS FIRST
-- ===========================================

-- Drop all level policies (from 001 migration)
DROP POLICY IF EXISTS "levels_read_public" ON levels;
DROP POLICY IF EXISTS "levels_read_own" ON levels;
DROP POLICY IF EXISTS "levels_read_admin" ON levels;
DROP POLICY IF EXISTS "levels_insert_own" ON levels;
DROP POLICY IF EXISTS "levels_insert_official" ON levels;
DROP POLICY IF EXISTS "levels_update_own" ON levels;
DROP POLICY IF EXISTS "levels_update_admin" ON levels;
DROP POLICY IF EXISTS "levels_delete_own" ON levels;
DROP POLICY IF EXISTS "levels_delete_official" ON levels;

-- Also drop any policies with different naming (in case)
DROP POLICY IF EXISTS "levels_select_public" ON levels;
DROP POLICY IF EXISTS "levels_select_own" ON levels;
DROP POLICY IF EXISTS "levels_admin_all" ON levels;

-- Drop level_ratings policies
DROP POLICY IF EXISTS "level_ratings_select" ON level_ratings;
DROP POLICY IF EXISTS "level_ratings_insert_own" ON level_ratings;
DROP POLICY IF EXISTS "level_ratings_update_own" ON level_ratings;
DROP POLICY IF EXISTS "level_ratings_delete_own" ON level_ratings;
DROP POLICY IF EXISTS "ratings_read" ON level_ratings;
DROP POLICY IF EXISTS "ratings_insert_own" ON level_ratings;
DROP POLICY IF EXISTS "ratings_update_own" ON level_ratings;
DROP POLICY IF EXISTS "ratings_delete_own" ON level_ratings;

-- Drop indexes that depend on user_id
DROP INDEX IF EXISTS idx_levels_user_id;

-- Drop unique constraint on level_ratings (level_id, user_id)
ALTER TABLE level_ratings DROP CONSTRAINT IF EXISTS level_ratings_level_id_user_id_key;

-- ===========================================
-- CLEANUP EXISTING DATA
-- This is safe since we only have seeded test data
-- ===========================================

-- Remove existing level data (will be re-seeded)
DELETE FROM level_ratings;
DELETE FROM levels;

-- Store existing admin auth0 IDs for re-creation
CREATE TEMP TABLE temp_admins AS
SELECT user_id as auth0_id, display_name, email,
       can_review_levels, can_manage_admins, can_manage_official, can_view_analytics,
       is_active, expires_at, created_at, created_by, notes
FROM admins;

-- Clear admins table
DELETE FROM admins;

-- ===========================================
-- USERS TABLE
-- Maps external Auth0 IDs to internal UUIDs
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth0_id TEXT UNIQUE NOT NULL,  -- Auth0 sub claim (e.g., "facebook|123")
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);

-- ===========================================
-- FUNCTION: Get or create internal user ID
-- ===========================================
CREATE OR REPLACE FUNCTION get_or_create_user_id(p_auth0_id TEXT)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to find existing user
    SELECT id INTO v_user_id FROM users WHERE auth0_id = p_auth0_id;

    -- Create if not found
    IF v_user_id IS NULL THEN
        INSERT INTO users (auth0_id) VALUES (p_auth0_id)
        RETURNING id INTO v_user_id;
    END IF;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCTION: Get current user's internal ID from JWT
-- ===========================================
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM users
        WHERE auth0_id = auth.jwt() ->> 'sub'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- ALTER LEVELS TABLE
-- Change user_id from TEXT to UUID
-- ===========================================
-- Use CASCADE to drop all dependent objects (policies, indexes, etc.)
ALTER TABLE levels
    DROP COLUMN user_id CASCADE;

ALTER TABLE levels
    ADD COLUMN user_id UUID REFERENCES users(id);

-- Make user_id required (can't be NOT NULL until we have data)
-- Will add constraint after re-seeding

-- Recreate index for user_id
CREATE INDEX idx_levels_user_id ON levels(user_id);

-- ===========================================
-- ALTER LEVEL_RATINGS TABLE
-- Change user_id from TEXT to UUID
-- ===========================================
-- Use CASCADE to drop all dependent objects
ALTER TABLE level_ratings
    DROP COLUMN user_id CASCADE;

ALTER TABLE level_ratings
    ADD COLUMN user_id UUID REFERENCES users(id);

-- Recreate unique constraint
ALTER TABLE level_ratings
    ADD CONSTRAINT level_ratings_level_id_user_id_key UNIQUE (level_id, user_id);

-- ===========================================
-- ALTER ADMINS TABLE
-- Add internal user reference, keep auth0 ID for lookup
-- ===========================================
ALTER TABLE admins
    ADD COLUMN internal_user_id UUID REFERENCES users(id);

-- ===========================================
-- RESTORE ADMINS WITH USER MAPPING
-- ===========================================
-- First create user records for existing admins
INSERT INTO users (auth0_id, display_name, email)
SELECT auth0_id, display_name, email FROM temp_admins
ON CONFLICT (auth0_id) DO NOTHING;

-- Restore admins with internal user ID reference
INSERT INTO admins (user_id, internal_user_id, display_name, email,
                    can_review_levels, can_manage_admins, can_manage_official, can_view_analytics,
                    is_active, expires_at, created_at, created_by, notes)
SELECT
    ta.auth0_id,
    u.id,
    ta.display_name,
    ta.email,
    ta.can_review_levels,
    ta.can_manage_admins,
    ta.can_manage_official,
    ta.can_view_analytics,
    ta.is_active,
    ta.expires_at,
    ta.created_at,
    ta.created_by,
    ta.notes
FROM temp_admins ta
JOIN users u ON u.auth0_id = ta.auth0_id;

DROP TABLE temp_admins;

-- ===========================================
-- RECREATE RLS POLICIES USING auth_user_id()
-- ===========================================

-- Levels: Anyone can read official and published levels
CREATE POLICY "levels_select_public" ON levels FOR SELECT
    USING (level_type IN ('official', 'published'));

-- Levels: Users can read their own levels
CREATE POLICY "levels_select_own" ON levels FOR SELECT
    USING (user_id = auth_user_id());

-- Levels: Users can create levels (assigned to themselves)
CREATE POLICY "levels_insert_own" ON levels FOR INSERT
    WITH CHECK (user_id = auth_user_id());

-- Levels: Users can update their own non-official levels
CREATE POLICY "levels_update_own" ON levels FOR UPDATE
    USING (user_id = auth_user_id() AND level_type != 'official');

-- Levels: Users can delete their own non-official levels
CREATE POLICY "levels_delete_own" ON levels FOR DELETE
    USING (user_id = auth_user_id() AND level_type != 'official');

-- Levels: Admins have full access
-- Note: is_admin() is defined in 001 migration and uses auth.uid() internally
-- We need to update is_admin to use auth.jwt() ->> 'sub' for Auth0 compatibility
CREATE POLICY "levels_admin_all" ON levels FOR ALL
    USING (is_admin());

-- Level ratings: Anyone can read
CREATE POLICY "level_ratings_select" ON level_ratings FOR SELECT
    USING (true);

-- Level ratings: Users can insert their own
CREATE POLICY "level_ratings_insert_own" ON level_ratings FOR INSERT
    WITH CHECK (user_id = auth_user_id());

-- Level ratings: Users can update their own
CREATE POLICY "level_ratings_update_own" ON level_ratings FOR UPDATE
    USING (user_id = auth_user_id());

-- Level ratings: Users can delete their own
CREATE POLICY "level_ratings_delete_own" ON level_ratings FOR DELETE
    USING (user_id = auth_user_id());

-- ===========================================
-- UPDATE HELPER FUNCTIONS
-- ===========================================

-- Update submit_level_for_review to use UUID
CREATE OR REPLACE FUNCTION submit_level_for_review(level_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE levels
    SET level_type = 'pending_review',
        submitted_at = NOW()
    WHERE id = level_id
      AND user_id = auth_user_id()
      AND level_type IN ('private', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- USERS TABLE RLS
-- ===========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Anyone can read basic user info
CREATE POLICY "users_select" ON users FOR SELECT
    USING (true);

-- Users are created via get_or_create_user_id function (SECURITY DEFINER)
-- Direct inserts not allowed via API

-- Users can update their own profile
CREATE POLICY "users_update_own" ON users FOR UPDATE
    USING (auth0_id = auth.jwt() ->> 'sub');
