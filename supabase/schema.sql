create table public._migrations
(
    id          serial
        primary key,
    name        text not null
        unique,
    executed_at timestamp with time zone default now()
);

alter table public._migrations
    owner to postgres;

grant select, update, usage on sequence public._migrations_id_seq to anon;

grant select, update, usage on sequence public._migrations_id_seq to authenticated;

grant select, update, usage on sequence public._migrations_id_seq to service_role;

grant delete, insert, references, select, trigger, truncate, update on public._migrations to anon;

grant delete, insert, references, select, trigger, truncate, update on public._migrations to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public._migrations to service_role;

create table public.users
(
    id            uuid                     default gen_random_uuid() not null
        primary key,
    auth0_id      text                                               not null
        unique,
    display_name  text,
    email         text,
    avatar_url    text,
    created_at    timestamp with time zone default now(),
    last_login_at timestamp with time zone default now()
);

alter table public.users
    owner to postgres;

create table public.leaderboard
(
    id                  uuid                     default gen_random_uuid() not null
        primary key,
    level_id            text                                               not null,
    level_name          text                                               not null,
    completed           boolean                                            not null,
    end_reason          text                                               not null,
    game_time_seconds   numeric                                            not null,
    asteroids_destroyed integer                                            not null,
    total_asteroids     integer                                            not null,
    accuracy            numeric                                            not null,
    hull_damage_taken   numeric                                            not null,
    fuel_consumed       numeric                                            not null,
    final_score         integer                                            not null,
    star_rating         integer                                            not null,
    created_at          timestamp with time zone default now(),
    is_test_data        boolean                  default false             not null,
    user_id             uuid
        constraint leaderboard_internal_user_id_fkey
            references public.users
);

alter table public.leaderboard
    owner to postgres;

create index idx_leaderboard_score
    on public.leaderboard (final_score desc);

create index idx_leaderboard_level
    on public.leaderboard (level_id);

create index idx_leaderboard_test_data
    on public.leaderboard (is_test_data)
    where (is_test_data = true);

create index idx_leaderboard_user_id
    on public.leaderboard (user_id);

grant delete, insert, references, select, trigger, truncate, update on public.leaderboard to anon;

grant delete, insert, references, select, trigger, truncate, update on public.leaderboard to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.leaderboard to service_role;

create table public.admins
(
    id                  uuid                     default gen_random_uuid() not null
        primary key,
    user_id             text                                               not null
        unique,
    display_name        text,
    email               text,
    can_review_levels   boolean                  default true,
    can_manage_admins   boolean                  default false,
    can_manage_official boolean                  default false,
    can_view_analytics  boolean                  default false,
    is_active           boolean                  default true,
    expires_at          timestamp with time zone,
    created_at          timestamp with time zone default now(),
    created_by          text,
    notes               text,
    internal_user_id    uuid
        references public.users
);

alter table public.admins
    owner to postgres;

create index idx_admins_user_id
    on public.admins (user_id);

create index idx_admins_active
    on public.admins (is_active)
    where (is_active = true);

grant delete, insert, references, select, trigger, truncate, update on public.admins to anon;

grant delete, insert, references, select, trigger, truncate, update on public.admins to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.admins to service_role;

create table public.levels
(
    id                  uuid                     default gen_random_uuid() not null
        primary key,
    slug                text
        unique
        constraint valid_slug_format
            check (validate_slug(slug)),
    name                text                                               not null,
    description         text,
    difficulty          text                                               not null
        constraint valid_difficulty
            check (difficulty = ANY
                   (ARRAY ['recruit'::text, 'pilot'::text, 'captain'::text, 'commander'::text, 'test'::text])),
    estimated_time      text,
    tags                text[]                   default '{}'::text[],
    config              jsonb                                              not null,
    mission_brief       text[]                   default '{}'::text[],
    mission_brief_audio text,
    level_type          text                     default 'private'::text   not null
        constraint valid_level_type
            check (level_type = ANY
                   (ARRAY ['official'::text, 'private'::text, 'pending_review'::text, 'published'::text, 'rejected'::text])),
    sort_order          integer                  default 0,
    unlock_requirements text[]                   default '{}'::text[],
    default_locked      boolean                  default false,
    submitted_at        timestamp with time zone,
    reviewed_at         timestamp with time zone,
    reviewed_by         text,
    review_notes        text,
    play_count          integer                  default 0,
    completion_count    integer                  default 0,
    avg_rating          numeric(3, 2)            default 0,
    rating_count        integer                  default 0,
    created_at          timestamp with time zone default now(),
    updated_at          timestamp with time zone default now(),
    user_id             uuid
        references public.users
);

alter table public.levels
    owner to postgres;

create index idx_levels_type
    on public.levels (level_type);

create index idx_levels_slug
    on public.levels (slug);

create index idx_levels_official_order
    on public.levels (sort_order)
    where (level_type = 'official'::text);

create index idx_levels_published
    on public.levels (created_at desc)
    where (level_type = 'published'::text);

create index idx_levels_pending
    on public.levels (submitted_at)
    where (level_type = 'pending_review'::text);

create index idx_levels_user_id
    on public.levels (user_id);

grant delete, insert, references, select, trigger, truncate, update on public.levels to anon;

grant delete, insert, references, select, trigger, truncate, update on public.levels to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.levels to service_role;

create table public.level_ratings
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    level_id   uuid                                               not null
        references public.levels
            on delete cascade,
    rating     integer                                            not null
        constraint level_ratings_rating_check
            check ((rating >= 1) AND (rating <= 5)),
    created_at timestamp with time zone default now(),
    user_id    uuid
        references public.users,
    unique (level_id, user_id)
);

alter table public.level_ratings
    owner to postgres;

create index idx_ratings_level
    on public.level_ratings (level_id);

grant delete, insert, references, select, trigger, truncate, update on public.level_ratings to anon;

grant delete, insert, references, select, trigger, truncate, update on public.level_ratings to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.level_ratings to service_role;

create index idx_users_auth0_id
    on public.users (auth0_id);

grant delete, insert, references, select, trigger, truncate, update on public.users to anon;

grant delete, insert, references, select, trigger, truncate, update on public.users to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.users to service_role;

create table public.hints
(
    id           uuid                     default gen_random_uuid() not null
        primary key,
    level_id     uuid                                               not null
        references public.levels
            on delete cascade,
    event_type   text                                               not null,
    event_config jsonb                    default '{}'::jsonb       not null,
    audio_url    text                                               not null,
    play_mode    text                     default 'once'::text      not null,
    sort_order   integer                  default 0,
    created_at   timestamp with time zone default now()
);

alter table public.hints
    owner to postgres;

create index idx_hints_level
    on public.hints (level_id);

grant select on public.hints to anon;

grant select on public.hints to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.hints to service_role;

