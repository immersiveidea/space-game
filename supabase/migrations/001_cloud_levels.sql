-- ===========================================
-- CLOUD LEVELS MIGRATION
-- Creates tables for cloud-based level storage
-- ===========================================

-- ===========================================
-- ADMINS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,       -- Auth0 sub claim

    -- Admin info
    display_name TEXT,                  -- For audit logs
    email TEXT,                         -- For notifications

    -- Permissions (granular control)
    can_review_levels BOOLEAN DEFAULT true,
    can_manage_admins BOOLEAN DEFAULT false,  -- Super admin only
    can_manage_official BOOLEAN DEFAULT false, -- Create/edit official levels
    can_view_analytics BOOLEAN DEFAULT false,

    -- Status
    is_active BOOLEAN DEFAULT true,     -- Disable without deleting
    expires_at TIMESTAMPTZ,             -- Optional expiration

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,                    -- user_id of admin who added them
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(is_active) WHERE is_active = true;

-- ===========================================
-- LEVELS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    user_id TEXT NOT NULL,              -- Auth0 sub claim (creator)

    -- Identity & Metadata
    slug TEXT UNIQUE,                   -- URL-friendly identifier, user-chosen, must be unique
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL,
    estimated_time TEXT,
    tags TEXT[] DEFAULT '{}',

    -- Level Configuration (the actual level data)
    config JSONB NOT NULL,              -- Full LevelConfig object

    -- Mission Brief (displayed before level starts)
    mission_brief TEXT[] DEFAULT '{}',  -- Array of objective strings

    -- Type & Status
    level_type TEXT NOT NULL DEFAULT 'private',
        -- 'official', 'private', 'pending_review', 'published', 'rejected'

    -- Unlock/Progression (for official levels)
    sort_order INTEGER DEFAULT 0,       -- Display order for official levels
    unlock_requirements TEXT[] DEFAULT '{}',  -- Level IDs that must be completed first
    default_locked BOOLEAN DEFAULT false,

    -- Review (for user submissions)
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,                   -- Admin user_id who reviewed
    review_notes TEXT,                  -- Admin feedback (especially for rejections)

    -- Stats (to be populated by triggers/functions)
    play_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_level_type CHECK (
        level_type IN ('official', 'private', 'pending_review', 'published', 'rejected')
    ),
    CONSTRAINT valid_difficulty CHECK (
        difficulty IN ('recruit', 'pilot', 'captain', 'commander', 'test')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_levels_user_id ON levels(user_id);
CREATE INDEX IF NOT EXISTS idx_levels_type ON levels(level_type);
CREATE INDEX IF NOT EXISTS idx_levels_slug ON levels(slug);
CREATE INDEX IF NOT EXISTS idx_levels_official_order ON levels(sort_order) WHERE level_type = 'official';
CREATE INDEX IF NOT EXISTS idx_levels_published ON levels(created_at DESC) WHERE level_type = 'published';
CREATE INDEX IF NOT EXISTS idx_levels_pending ON levels(submitted_at) WHERE level_type = 'pending_review';

-- ===========================================
-- LEVEL RATINGS TABLE (Future)
-- ===========================================
CREATE TABLE IF NOT EXISTS level_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(level_id, user_id)  -- One rating per user per level
);

CREATE INDEX IF NOT EXISTS idx_ratings_level ON level_ratings(level_id);

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Helper function to check if current user is an active admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE user_id = auth.uid()::text
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check specific permission
CREATE OR REPLACE FUNCTION has_admin_permission(permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    admin_record admins%ROWTYPE;
BEGIN
    SELECT * INTO admin_record FROM admins
    WHERE user_id = auth.uid()::text
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());

    IF admin_record IS NULL THEN
        RETURN false;
    END IF;

    CASE permission
        WHEN 'review_levels' THEN RETURN admin_record.can_review_levels;
        WHEN 'manage_admins' THEN RETURN admin_record.can_manage_admins;
        WHEN 'manage_official' THEN RETURN admin_record.can_manage_official;
        WHEN 'view_analytics' THEN RETURN admin_record.can_view_analytics;
        ELSE RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- SLUG VALIDATION
-- ===========================================

-- Function to validate slug format (lowercase, alphanumeric, hyphens only)
CREATE OR REPLACE FUNCTION validate_slug(slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow NULL slugs (optional)
    IF slug IS NULL THEN
        RETURN true;
    END IF;

    -- Must be 3-50 chars, lowercase alphanumeric with hyphens, no leading/trailing hyphens
    RETURN slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if slug is available (callable from client)
CREATE OR REPLACE FUNCTION is_slug_available(check_slug TEXT, exclude_level_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_slug IS NULL THEN
        RETURN true;
    END IF;

    RETURN NOT EXISTS (
        SELECT 1 FROM levels
        WHERE slug = check_slug
        AND (exclude_level_id IS NULL OR id != exclude_level_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add constraint for slug format
ALTER TABLE levels ADD CONSTRAINT valid_slug_format
    CHECK (validate_slug(slug));

-- ===========================================
-- ROW LEVEL SECURITY - ADMINS
-- ===========================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only super admins can view/manage other admins
CREATE POLICY admins_select ON admins
    FOR SELECT USING (has_admin_permission('manage_admins'));

CREATE POLICY admins_insert ON admins
    FOR INSERT WITH CHECK (has_admin_permission('manage_admins'));

CREATE POLICY admins_update ON admins
    FOR UPDATE USING (has_admin_permission('manage_admins'));

CREATE POLICY admins_delete ON admins
    FOR DELETE USING (has_admin_permission('manage_admins'));

-- Users can check if they themselves are admin (for UI purposes)
CREATE POLICY admins_select_self ON admins
    FOR SELECT USING (user_id = auth.uid()::text);

-- ===========================================
-- ROW LEVEL SECURITY - LEVELS
-- ===========================================
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;

-- Everyone can read official and published levels (no auth required)
CREATE POLICY levels_read_public ON levels
    FOR SELECT
    USING (level_type IN ('official', 'published'));

-- Authenticated users can read their own levels (any status)
CREATE POLICY levels_read_own ON levels
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Admins with review permission can read all levels (for review queue)
CREATE POLICY levels_read_admin ON levels
    FOR SELECT
    USING (has_admin_permission('review_levels'));

-- Users can insert their own levels (as private initially)
CREATE POLICY levels_insert_own ON levels
    FOR INSERT
    WITH CHECK (
        auth.uid()::text = user_id
        AND level_type = 'private'
    );

-- Admins can insert official levels
CREATE POLICY levels_insert_official ON levels
    FOR INSERT
    WITH CHECK (
        has_admin_permission('manage_official')
        AND level_type = 'official'
    );

-- Users can update their own non-official levels
CREATE POLICY levels_update_own ON levels
    FOR UPDATE
    USING (
        auth.uid()::text = user_id
        AND level_type != 'official'
    );

-- Admins can update any level (for review actions and official level management)
CREATE POLICY levels_update_admin ON levels
    FOR UPDATE
    USING (
        has_admin_permission('review_levels')
        OR (has_admin_permission('manage_official') AND level_type = 'official')
    );

-- Users can delete their own private/rejected levels
CREATE POLICY levels_delete_own ON levels
    FOR DELETE
    USING (
        auth.uid()::text = user_id
        AND level_type IN ('private', 'rejected')
    );

-- Admins can delete official levels
CREATE POLICY levels_delete_official ON levels
    FOR DELETE
    USING (
        has_admin_permission('manage_official')
        AND level_type = 'official'
    );

-- ===========================================
-- ROW LEVEL SECURITY - RATINGS
-- ===========================================
ALTER TABLE level_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings
CREATE POLICY ratings_read ON level_ratings
    FOR SELECT USING (true);

-- Authenticated users can insert their own ratings
CREATE POLICY ratings_insert ON level_ratings
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own ratings
CREATE POLICY ratings_update ON level_ratings
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Users can delete their own ratings
CREATE POLICY ratings_delete ON level_ratings
    FOR DELETE USING (auth.uid()::text = user_id);

-- ===========================================
-- WORKFLOW FUNCTIONS
-- ===========================================

-- Function to submit level for review
CREATE OR REPLACE FUNCTION submit_level_for_review(level_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE levels
    SET
        level_type = 'pending_review',
        submitted_at = NOW(),
        updated_at = NOW()
    WHERE id = level_id
    AND user_id = auth.uid()::text
    AND level_type = 'private';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve level (admin only)
CREATE OR REPLACE FUNCTION approve_level(p_level_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
    IF NOT has_admin_permission('review_levels') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    UPDATE levels
    SET
        level_type = 'published',
        reviewed_at = NOW(),
        reviewed_by = auth.uid()::text,
        review_notes = p_notes,
        updated_at = NOW()
    WHERE id = p_level_id
    AND level_type = 'pending_review';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject level (admin only)
CREATE OR REPLACE FUNCTION reject_level(p_level_id UUID, p_notes TEXT)
RETURNS void AS $$
BEGIN
    IF NOT has_admin_permission('review_levels') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    UPDATE levels
    SET
        level_type = 'rejected',
        reviewed_at = NOW(),
        reviewed_by = auth.uid()::text,
        review_notes = p_notes,
        updated_at = NOW()
    WHERE id = p_level_id
    AND level_type = 'pending_review';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS levels_updated_at ON levels;
CREATE TRIGGER levels_updated_at
    BEFORE UPDATE ON levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- STATS FUNCTIONS (for future use)
-- ===========================================

-- Function to increment play count
CREATE OR REPLACE FUNCTION increment_play_count(p_level_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE levels
    SET play_count = play_count + 1
    WHERE id = p_level_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment completion count
CREATE OR REPLACE FUNCTION increment_completion_count(p_level_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE levels
    SET completion_count = completion_count + 1
    WHERE id = p_level_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
