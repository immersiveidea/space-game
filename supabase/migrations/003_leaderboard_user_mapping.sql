-- ===========================================
-- LEADERBOARD USER MAPPING MIGRATION
-- Migrates leaderboard from Auth0 IDs to internal UUIDs
-- Normalizes player_name to users table
-- ===========================================

-- ===========================================
-- CREATE USER RECORDS FOR EXISTING LEADERBOARD ENTRIES
-- ===========================================

-- Create user records for any Auth0 IDs in leaderboard that don't have users yet
-- Uses player_name from most recent entry as initial display_name
-- DISTINCT ON ensures only one row per user_id (the most recent by created_at)
INSERT INTO users (auth0_id, display_name)
SELECT DISTINCT ON (l.user_id) l.user_id, l.player_name
FROM leaderboard l
WHERE l.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.auth0_id = l.user_id)
ORDER BY l.user_id, l.created_at DESC
ON CONFLICT (auth0_id) DO NOTHING;

-- ===========================================
-- ADD AND POPULATE INTERNAL USER ID
-- ===========================================

-- Add internal_user_id column (will replace user_id)
ALTER TABLE leaderboard
    ADD COLUMN internal_user_id UUID REFERENCES users(id);

-- Populate internal_user_id from existing user_id (auth0_id)
UPDATE leaderboard l
SET internal_user_id = u.id
FROM users u
WHERE l.user_id = u.auth0_id;

-- Create index for new column
CREATE INDEX idx_leaderboard_internal_user_id ON leaderboard(internal_user_id);

-- ===========================================
-- DROP OLD COLUMNS AND RENAME
-- ===========================================

-- Drop old columns (player_name normalized to users table, user_id replaced by UUID)
ALTER TABLE leaderboard DROP COLUMN player_name;
ALTER TABLE leaderboard DROP COLUMN user_id;

-- Rename internal_user_id to user_id for consistency
ALTER TABLE leaderboard RENAME COLUMN internal_user_id TO user_id;

-- Rename index to match new column name
ALTER INDEX idx_leaderboard_internal_user_id RENAME TO idx_leaderboard_user_id;
