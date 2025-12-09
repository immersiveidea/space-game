-- Level Change History System
-- Tracks all changes to levels for auditing and potential rollback

-- Level change history table
CREATE TABLE level_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id),  -- NULL if unknown
    change_type TEXT NOT NULL DEFAULT 'update',  -- 'update', 'submitted', 'published', 'rejected'

    -- Snapshot of previous state (before the change)
    previous_config JSONB,
    previous_name TEXT,
    previous_difficulty TEXT,
    previous_level_type TEXT,

    -- Snapshot of new state (after the change)
    new_config JSONB,
    new_name TEXT,
    new_difficulty TEXT,
    new_level_type TEXT,

    -- Metadata
    change_summary TEXT,  -- Optional description
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_level_history_level_id ON level_history(level_id);
CREATE INDEX idx_level_history_created_at ON level_history(created_at DESC);
CREATE INDEX idx_level_history_changed_by ON level_history(changed_by);

-- RLS: Level owner and admins can view history
ALTER TABLE level_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of their own levels"
    ON level_history FOR SELECT
    USING (
        level_id IN (SELECT id FROM levels WHERE user_id = auth_user_id())
    );

CREATE POLICY "Admins can view all history"
    ON level_history FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM admins WHERE user_id = auth_user_id() AND is_active = true)
    );

-- Helper function to set user context (call before updates in RPCs)
CREATE OR REPLACE FUNCTION set_current_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::TEXT, true);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to log changes
CREATE OR REPLACE FUNCTION log_level_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to get user from session variable (set by RPC functions)
    BEGIN
        v_user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Fall back to auth.uid() lookup if available
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM users WHERE auth0_id = auth.uid();
    END IF;

    -- Only log if something meaningful changed
    IF OLD.config IS DISTINCT FROM NEW.config
       OR OLD.name IS DISTINCT FROM NEW.name
       OR OLD.difficulty IS DISTINCT FROM NEW.difficulty
       OR OLD.level_type IS DISTINCT FROM NEW.level_type THEN

        INSERT INTO level_history (
            level_id,
            changed_by,
            change_type,
            previous_config,
            previous_name,
            previous_difficulty,
            previous_level_type,
            new_config,
            new_name,
            new_difficulty,
            new_level_type
        ) VALUES (
            OLD.id,
            v_user_id,
            CASE
                WHEN OLD.level_type IS DISTINCT FROM NEW.level_type THEN
                    CASE NEW.level_type
                        WHEN 'pending_review' THEN 'submitted'
                        WHEN 'published' THEN 'published'
                        WHEN 'rejected' THEN 'rejected'
                        ELSE 'update'
                    END
                ELSE 'update'
            END,
            OLD.config,
            OLD.name,
            OLD.difficulty,
            OLD.level_type,
            NEW.config,
            NEW.name,
            NEW.difficulty,
            NEW.level_type
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to levels table
CREATE TRIGGER level_change_history
    AFTER UPDATE ON levels
    FOR EACH ROW
    EXECUTE FUNCTION log_level_change();

-- RPC to get level history (for UI)
CREATE OR REPLACE FUNCTION get_level_history(p_level_id UUID)
RETURNS TABLE (
    id UUID,
    changed_by UUID,
    changed_by_email TEXT,
    change_type TEXT,
    previous_name TEXT,
    previous_difficulty TEXT,
    previous_level_type TEXT,
    new_name TEXT,
    new_difficulty TEXT,
    new_level_type TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.changed_by,
        u.email as changed_by_email,
        h.change_type,
        h.previous_name,
        h.previous_difficulty,
        h.previous_level_type,
        h.new_name,
        h.new_difficulty,
        h.new_level_type,
        h.created_at
    FROM level_history h
    LEFT JOIN users u ON h.changed_by = u.id
    WHERE h.level_id = p_level_id
    ORDER BY h.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to get full history entry with configs (for restore)
CREATE OR REPLACE FUNCTION get_level_history_entry(p_history_id UUID)
RETURNS TABLE (
    id UUID,
    level_id UUID,
    changed_by UUID,
    change_type TEXT,
    previous_config JSONB,
    new_config JSONB,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_level_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the level_id for this history entry
    SELECT lh.level_id INTO v_level_id FROM level_history lh WHERE lh.id = p_history_id;

    -- Get current user
    SELECT users.id INTO v_user_id FROM users WHERE auth0_id = auth.uid();

    -- Check if user owns the level or is admin
    IF NOT EXISTS (
        SELECT 1 FROM levels WHERE levels.id = v_level_id AND levels.user_id = v_user_id
    ) AND NOT EXISTS (
        SELECT 1 FROM admins WHERE admins.user_id = v_user_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT
        h.id,
        h.level_id,
        h.changed_by,
        h.change_type,
        h.previous_config,
        h.new_config,
        h.created_at
    FROM level_history h
    WHERE h.id = p_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
