create policy "Anyone can read leaderboard" on public.leaderboard
    as permissive
    for select
                   using true;

create policy "Allow all inserts" on public.leaderboard
    as permissive
    for insert
    with check true;

create function public.is_admin() returns boolean
    security definer
    language plpgsql
as
$$
BEGIN
RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE user_id = auth.uid()::text
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
);
END;
$$;

alter function public.is_admin() owner to postgres;

grant execute on function public.is_admin() to anon;

grant execute on function public.is_admin() to authenticated;

grant execute on function public.is_admin() to service_role;

create function public.has_admin_permission(permission text) returns boolean
    security definer
    language plpgsql
as
$$
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
$$;

alter function public.has_admin_permission(text) owner to postgres;

grant execute on function public.has_admin_permission(text) to anon;

grant execute on function public.has_admin_permission(text) to authenticated;

grant execute on function public.has_admin_permission(text) to service_role;

create function public.validate_slug(slug text) returns boolean
    immutable
    language plpgsql
as
$$
BEGIN
    -- Allow NULL slugs (optional)
    IF slug IS NULL THEN
        RETURN true;
END IF;

    -- Must be 3-50 chars, lowercase alphanumeric with hyphens, no leading/trailing hyphens
RETURN slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$';
END;
$$;

alter function public.validate_slug(text) owner to postgres;

grant execute on function public.validate_slug(text) to anon;

grant execute on function public.validate_slug(text) to authenticated;

grant execute on function public.validate_slug(text) to service_role;

create function public.is_slug_available(check_slug text, exclude_level_id uuid DEFAULT NULL::uuid) returns boolean
    security definer
    language plpgsql
as
$$
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
$$;

alter function public.is_slug_available(text, uuid) owner to postgres;

grant execute on function public.is_slug_available(text, uuid) to anon;

grant execute on function public.is_slug_available(text, uuid) to authenticated;

grant execute on function public.is_slug_available(text, uuid) to service_role;

create function public.submit_level_for_review(level_id uuid) returns void
    security definer
    language plpgsql
as
$$
BEGIN
UPDATE levels
SET level_type = 'pending_review',
    submitted_at = NOW()
WHERE id = level_id
  AND user_id = auth_user_id()
  AND level_type IN ('private', 'rejected');
END;
$$;

alter function public.submit_level_for_review(uuid) owner to postgres;

grant execute on function public.submit_level_for_review(uuid) to anon;

grant execute on function public.submit_level_for_review(uuid) to authenticated;

grant execute on function public.submit_level_for_review(uuid) to service_role;

create function public.approve_level(p_level_id uuid, p_notes text DEFAULT NULL::text) returns void
    security definer
    language plpgsql
as
$$
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
$$;

alter function public.approve_level(uuid, text) owner to postgres;

grant execute on function public.approve_level(uuid, text) to anon;

grant execute on function public.approve_level(uuid, text) to authenticated;

grant execute on function public.approve_level(uuid, text) to service_role;

create function public.reject_level(p_level_id uuid, p_notes text) returns void
    security definer
    language plpgsql
as
$$
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
$$;

alter function public.reject_level(uuid, text) owner to postgres;

grant execute on function public.reject_level(uuid, text) to anon;

grant execute on function public.reject_level(uuid, text) to authenticated;

grant execute on function public.reject_level(uuid, text) to service_role;

create function public.update_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$;

alter function public.update_updated_at() owner to postgres;

grant execute on function public.update_updated_at() to anon;

grant execute on function public.update_updated_at() to authenticated;

grant execute on function public.update_updated_at() to service_role;

create function public.increment_play_count(p_level_id uuid) returns void
    security definer
    language plpgsql
as
$$
BEGIN
UPDATE levels
SET play_count = play_count + 1
WHERE id = p_level_id;
END;
$$;

alter function public.increment_play_count(uuid) owner to postgres;

grant execute on function public.increment_play_count(uuid) to anon;

grant execute on function public.increment_play_count(uuid) to authenticated;

grant execute on function public.increment_play_count(uuid) to service_role;

create function public.increment_completion_count(p_level_id uuid) returns void
    security definer
    language plpgsql
as
$$
BEGIN
UPDATE levels
SET completion_count = completion_count + 1
WHERE id = p_level_id;
END;
$$;

alter function public.increment_completion_count(uuid) owner to postgres;

grant execute on function public.increment_completion_count(uuid) to anon;

grant execute on function public.increment_completion_count(uuid) to authenticated;

grant execute on function public.increment_completion_count(uuid) to service_role;

create function public.get_or_create_user_id(p_auth0_id text) returns uuid
    security definer
    language plpgsql
as
$$
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
$$;

alter function public.get_or_create_user_id(text) owner to postgres;

grant execute on function public.get_or_create_user_id(text) to anon;

grant execute on function public.get_or_create_user_id(text) to authenticated;

grant execute on function public.get_or_create_user_id(text) to service_role;

create function public.auth_user_id() returns uuid
    stable
    security definer
    language plpgsql
as
$$
BEGIN
RETURN (
    SELECT id FROM users
    WHERE auth0_id = auth.jwt() ->> 'sub'
    );
END;
$$;

alter function public.auth_user_id() owner to postgres;

grant execute on function public.auth_user_id() to anon;

grant execute on function public.auth_user_id() to authenticated;

grant execute on function public.auth_user_id() to service_role;

