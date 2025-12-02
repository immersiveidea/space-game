-- ===========================================
-- ADMINS TABLE: Use internal user ID
-- Changes admins.user_id from Auth0 TEXT to internal UUID
-- ===========================================

-- ===========================================
-- DROP DEPENDENT POLICIES
-- ===========================================
DROP POLICY IF EXISTS "levels_admin_all" ON levels;

-- ===========================================
-- BACKUP EXISTING ADMINS
-- ===========================================
CREATE TEMP TABLE temp_admins_backup AS
SELECT
    internal_user_id,
    display_name,
    email,
    can_review_levels,
    can_manage_admins,
    can_manage_official,
    can_view_analytics,
    is_active,
    expires_at,
    created_at,
    created_by,
    notes
FROM admins
WHERE internal_user_id IS NOT NULL;

-- ===========================================
-- DROP AND RECREATE ADMINS TABLE
-- ===========================================
DROP TABLE admins CASCADE;

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),  -- Internal UUID, not Auth0

    -- Admin info
    display_name TEXT,
    email TEXT,

    -- Permissions
    can_review_levels BOOLEAN DEFAULT true,
    can_manage_admins BOOLEAN DEFAULT false,
    can_manage_official BOOLEAN DEFAULT false,
    can_view_analytics BOOLEAN DEFAULT false,

    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),  -- Also use internal ID
    notes TEXT
);

CREATE INDEX idx_admins_user_id ON admins(user_id);
CREATE INDEX idx_admins_active ON admins(is_active) WHERE is_active = true;

-- ===========================================
-- RESTORE ADMINS
-- ===========================================
INSERT INTO admins (
    user_id, display_name, email,
    can_review_levels, can_manage_admins, can_manage_official, can_view_analytics,
    is_active, expires_at, created_at, notes
)
SELECT
    internal_user_id,
    display_name,
    email,
    can_review_levels,
    can_manage_admins,
    can_manage_official,
    can_view_analytics,
    is_active,
    expires_at,
    created_at,
    notes
FROM temp_admins_backup;

DROP TABLE temp_admins_backup;

-- ===========================================
-- UPDATE HELPER FUNCTIONS
-- ===========================================

-- is_admin: Check if current user is an active admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE user_id = auth_user_id()
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- has_admin_permission: Check specific permission
CREATE OR REPLACE FUNCTION has_admin_permission(permission TEXT) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth_user_id();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE user_id = v_user_id
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (
              (permission = 'can_review_levels' AND can_review_levels = true) OR
              (permission = 'can_manage_admins' AND can_manage_admins = true) OR
              (permission = 'can_manage_official' AND can_manage_official = true) OR
              (permission = 'can_view_analytics' AND can_view_analytics = true)
          )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- RECREATE RLS POLICIES
-- ===========================================
CREATE POLICY "levels_admin_all" ON levels FOR ALL
    USING (is_admin());

-- ===========================================
-- ENABLE RLS ON ADMINS
-- ===========================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only admins with can_manage_admins can view admin table
CREATE POLICY "admins_select" ON admins FOR SELECT
    USING (has_admin_permission('can_manage_admins') OR user_id = auth_user_id());

-- Only admins with can_manage_admins can modify
CREATE POLICY "admins_insert" ON admins FOR INSERT
    WITH CHECK (has_admin_permission('can_manage_admins'));

CREATE POLICY "admins_update" ON admins FOR UPDATE
    USING (has_admin_permission('can_manage_admins'));

CREATE POLICY "admins_delete" ON admins FOR DELETE
    USING (has_admin_permission('can_manage_admins'));
