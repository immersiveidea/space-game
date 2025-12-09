-- ===========================================
-- USER TOKENS MIGRATION
-- API tokens for editor plugin authentication
-- ===========================================

-- ===========================================
-- USER_TOKENS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Editor Token',
    token_hash TEXT NOT NULL,  -- SHA256 hash of token
    token_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "abc12345...")
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,  -- NULL = never expires
    is_revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX idx_user_tokens_hash ON user_tokens(token_hash);

-- ===========================================
-- FUNCTION: Create a new token for current user
-- Returns the raw token (only time it's visible)
-- ===========================================
CREATE OR REPLACE FUNCTION create_user_token(p_name TEXT DEFAULT 'Editor Token')
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
    v_raw_token TEXT;
    v_token_hash TEXT;
BEGIN
    -- Get current user's internal ID
    v_user_id := auth_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Generate secure random token (32 bytes = 64 hex chars)
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');

    -- Insert token record
    INSERT INTO user_tokens (user_id, name, token_hash, token_prefix)
    VALUES (v_user_id, p_name, v_token_hash, substring(v_raw_token, 1, 8));

    -- Return raw token (only time user sees it)
    RETURN v_raw_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCTION: Validate token and return user_id
-- Used by plugin to authenticate requests
-- ===========================================
CREATE OR REPLACE FUNCTION validate_user_token(p_token TEXT)
RETURNS UUID AS $$
DECLARE
    v_token_hash TEXT;
    v_user_id UUID;
BEGIN
    v_token_hash := encode(sha256(p_token::bytea), 'hex');

    SELECT user_id INTO v_user_id
    FROM user_tokens
    WHERE token_hash = v_token_hash
      AND is_revoked = FALSE
      AND (expires_at IS NULL OR expires_at > NOW());

    -- Update last_used_at if valid
    IF v_user_id IS NOT NULL THEN
        UPDATE user_tokens
        SET last_used_at = NOW()
        WHERE token_hash = v_token_hash;
    END IF;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCTION: Revoke a token
-- ===========================================
CREATE OR REPLACE FUNCTION revoke_user_token(p_token_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth_user_id();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE user_tokens
    SET is_revoked = TRUE
    WHERE id = p_token_id AND user_id = v_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "user_tokens_select_own" ON user_tokens FOR SELECT
    USING (user_id = auth_user_id());

-- Users can only delete their own tokens
CREATE POLICY "user_tokens_delete_own" ON user_tokens FOR DELETE
    USING (user_id = auth_user_id());

-- Insert/update via functions only (SECURITY DEFINER)

-- ===========================================
-- RPC FUNCTIONS FOR PLUGIN ACCESS
-- These bypass RLS using the editor token
-- ===========================================

-- Get user's levels using editor token
CREATE OR REPLACE FUNCTION get_my_levels_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    difficulty TEXT,
    level_type TEXT,
    config JSONB,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := validate_user_token(p_token);
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired token';
    END IF;

    RETURN QUERY
    SELECT l.id, l.name, l.description, l.difficulty, l.level_type, l.config, l.updated_at
    FROM levels l
    WHERE l.user_id = v_user_id
    ORDER BY l.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Save/update a level using editor token
CREATE OR REPLACE FUNCTION save_level_by_token(
    p_token TEXT,
    p_name TEXT,
    p_difficulty TEXT,
    p_config JSONB,
    p_level_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_result_id UUID;
BEGIN
    v_user_id := validate_user_token(p_token);
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired token';
    END IF;

    IF p_level_id IS NOT NULL THEN
        -- Update existing level (only if owned by user)
        UPDATE levels
        SET name = p_name, difficulty = p_difficulty, config = p_config, updated_at = NOW()
        WHERE id = p_level_id AND user_id = v_user_id
        RETURNING id INTO v_result_id;

        IF v_result_id IS NULL THEN
            RAISE EXCEPTION 'Level not found or not owned by user';
        END IF;
    ELSE
        -- Create new level
        INSERT INTO levels (user_id, name, difficulty, config, level_type)
        VALUES (v_user_id, p_name, p_difficulty, p_config, 'private')
        RETURNING id INTO v_result_id;
    END IF;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
