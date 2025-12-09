import { SupabaseService } from './supabaseService';
import type { LevelConfig } from '../levels/config/levelConfig';
import log from '../core/logger';

/**
 * Level entry from the cloud database
 */
export interface CloudLevelEntry {
    id: string;
    slug: string | null;
    userId: string;
    name: string;
    description: string | null;
    difficulty: string;
    estimatedTime: string | null;
    tags: string[];
    config: LevelConfig;
    missionBrief: string[];
    levelType: 'official' | 'private' | 'pending_review' | 'published' | 'rejected';
    sortOrder: number;
    unlockRequirements: string[];
    defaultLocked: boolean;
    playCount: number;
    completionCount: number;
    avgRating: number;
    ratingCount: number;
    createdAt: string;
    updatedAt: string;
    reviewNotes?: string;
    missionBriefAudio?: string;
}

/**
 * Database row format (snake_case)
 */
interface LevelRow {
    id: string;
    slug: string | null;
    user_id: string;
    name: string;
    description: string | null;
    difficulty: string;
    estimated_time: string | null;
    tags: string[];
    config: LevelConfig | string;  // May come as string from some DB configurations
    mission_brief: string[];
    level_type: string;
    sort_order: number;
    unlock_requirements: string[];
    default_locked: boolean;
    play_count: number;
    completion_count: number;
    avg_rating: number;
    rating_count: number;
    created_at: string;
    updated_at: string;
    review_notes?: string;
    mission_brief_audio?: string;
}

/**
 * Convert database row to CloudLevelEntry
 */
function rowToEntry(row: LevelRow): CloudLevelEntry {
    // Handle config - it might come as string from some Supabase configurations
    let config: LevelConfig = row.config as LevelConfig;
    if (typeof row.config === 'string') {
        try {
            config = JSON.parse(row.config);
        } catch (e) {
            log.error('[CloudLevelService] Failed to parse config string:', e);
        }
    }

    return {
        id: row.id,
        slug: row.slug,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        difficulty: row.difficulty,
        estimatedTime: row.estimated_time,
        tags: row.tags || [],
        config: config,
        missionBrief: row.mission_brief || [],
        levelType: row.level_type as CloudLevelEntry['levelType'],
        sortOrder: row.sort_order,
        unlockRequirements: row.unlock_requirements || [],
        defaultLocked: row.default_locked,
        playCount: row.play_count,
        completionCount: row.completion_count,
        avgRating: Number(row.avg_rating) || 0,
        ratingCount: row.rating_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        reviewNotes: row.review_notes,
        missionBriefAudio: row.mission_brief_audio,
    };
}

/**
 * Service for interacting with cloud-based level storage via Supabase
 */
export class CloudLevelService {
    private static _instance: CloudLevelService;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): CloudLevelService {
        if (!CloudLevelService._instance) {
            CloudLevelService._instance = new CloudLevelService();
        }
        return CloudLevelService._instance;
    }

    /**
     * Check if cloud level storage is available
     */
    public isAvailable(): boolean {
        return SupabaseService.getInstance().isConfigured();
    }

    // =========================================
    // FETCHING LEVELS
    // =========================================

    /**
     * Get all official levels (sorted by sort_order)
     */
    public async getOfficialLevels(): Promise<CloudLevelEntry[]> {
        const client = SupabaseService.getInstance().getClient();
        if (!client) {
            log.warn('[CloudLevelService] Supabase not configured');
            return [];
        }

        log.info('[CloudLevelService] Fetching official levels...');
        const { data, error } = await client
            .from('levels')
            .select('*')
            .eq('level_type', 'official')
            .order('sort_order', { ascending: true });

        log.info('[CloudLevelService] Query result - data:', data?.length, 'rows, error:', error);
        if (data) {
            log.info('[CloudLevelService] Raw rows:', JSON.stringify(data, null, 2));
        }

        if (error) {
            log.error('[CloudLevelService] Failed to fetch official levels:', error);
            return [];
        }

        return (data || []).map(rowToEntry);
    }

    /**
     * Get published community levels (paginated)
     */
    public async getPublishedLevels(limit: number = 20, offset: number = 0): Promise<CloudLevelEntry[]> {
        const client = SupabaseService.getInstance().getClient();
        if (!client) {
            log.warn('[CloudLevelService] Supabase not configured');
            return [];
        }

        const { data, error } = await client
            .from('levels')
            .select('*')
            .eq('level_type', 'published')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            log.error('[CloudLevelService] Failed to fetch published levels:', error);
            return [];
        }

        return (data || []).map(rowToEntry);
    }

    /**
     * Get current user's levels (requires auth)
     */
    public async getMyLevels(): Promise<CloudLevelEntry[]> {
        const supabaseService = SupabaseService.getInstance();
        const client = await supabaseService.getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return [];
        }

        // Get internal user ID (UUID)
        const internalUserId = await supabaseService.ensureUserExists();
        if (!internalUserId) {
            log.warn('[CloudLevelService] No internal user ID available');
            return [];
        }

        const { data, error } = await client
            .from('levels')
            .select('*')
            .eq('user_id', internalUserId)
            .order('updated_at', { ascending: false });

        if (error) {
            log.error('[CloudLevelService] Failed to fetch user levels:', error);
            return [];
        }

        return (data || []).map(rowToEntry);
    }

    /**
     * Get a level by ID (tries authenticated client first for private levels)
     */
    public async getLevelById(id: string): Promise<CloudLevelEntry | null> {
        const supabaseService = SupabaseService.getInstance();

        // Try authenticated client first (needed for private levels)
        const authClient = await supabaseService.getAuthenticatedClient();
        if (authClient) {
            const { data, error } = await authClient
                .from('levels')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (!error && data) {
                return rowToEntry(data);
            }
        }

        // Fall back to public client for public levels
        const client = supabaseService.getClient();
        if (!client) {
            log.warn('[CloudLevelService] Supabase not configured');
            return null;
        }

        const { data, error } = await client
            .from('levels')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            log.error('[CloudLevelService] Failed to fetch level:', error);
            return null;
        }

        return data ? rowToEntry(data) : null;
    }

    /**
     * Get a level by slug
     */
    public async getLevelBySlug(slug: string): Promise<CloudLevelEntry | null> {
        const client = SupabaseService.getInstance().getClient();
        if (!client) {
            log.warn('[CloudLevelService] Supabase not configured');
            return null;
        }

        const { data, error } = await client
            .from('levels')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') {
                log.error('[CloudLevelService] Failed to fetch level by slug:', error);
            }
            return null;
        }

        return data ? rowToEntry(data) : null;
    }

    /**
     * Check if a slug is available
     */
    public async isSlugAvailable(slug: string, excludeLevelId?: string): Promise<boolean> {
        const client = SupabaseService.getInstance().getClient();
        if (!client) {
            return false;
        }

        const { data, error } = await client
            .rpc('is_slug_available', {
                check_slug: slug,
                exclude_level_id: excludeLevelId || null
            });

        if (error) {
            log.error('[CloudLevelService] Failed to check slug availability:', error);
            return false;
        }

        return data === true;
    }

    // =========================================
    // CRUD OPERATIONS (authenticated)
    // =========================================

    /**
     * Create a new level (as private)
     */
    public async createLevel(
        name: string,
        config: LevelConfig,
        options?: {
            slug?: string;
            description?: string;
            difficulty?: string;
            tags?: string[];
            missionBrief?: string[];
        }
    ): Promise<CloudLevelEntry | null> {
        const supabaseService = SupabaseService.getInstance();
        const client = await supabaseService.getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return null;
        }

        // Get internal user ID (UUID)
        const internalUserId = await supabaseService.ensureUserExists();
        if (!internalUserId) {
            log.warn('[CloudLevelService] No internal user ID available');
            return null;
        }

        const { data, error } = await client
            .from('levels')
            .insert({
                user_id: internalUserId,
                name,
                slug: options?.slug || null,
                description: options?.description || null,
                difficulty: options?.difficulty || config.difficulty || 'pilot',
                tags: options?.tags || [],
                config,
                mission_brief: options?.missionBrief || [],
                level_type: 'private',
            })
            .select()
            .single();

        if (error) {
            log.error('[CloudLevelService] Failed to create level:', error);
            return null;
        }

        return data ? rowToEntry(data) : null;
    }

    /**
     * Update an existing level
     */
    public async updateLevel(
        id: string,
        updates: {
            name?: string;
            slug?: string;
            description?: string;
            difficulty?: string;
            tags?: string[];
            config?: LevelConfig;
            missionBrief?: string[];
        }
    ): Promise<CloudLevelEntry | null> {
        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return null;
        }

        const updateData: Record<string, any> = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.slug !== undefined) updateData.slug = updates.slug;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.difficulty !== undefined) updateData.difficulty = updates.difficulty;
        if (updates.tags !== undefined) updateData.tags = updates.tags;
        if (updates.config !== undefined) updateData.config = updates.config;
        if (updates.missionBrief !== undefined) updateData.mission_brief = updates.missionBrief;

        const { data, error } = await client
            .from('levels')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            log.error('[CloudLevelService] Failed to update level:', error);
            return null;
        }

        return data ? rowToEntry(data) : null;
    }

    /**
     * Delete a level
     */
    public async deleteLevel(id: string): Promise<boolean> {
        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return false;
        }

        const { error } = await client
            .from('levels')
            .delete()
            .eq('id', id);

        if (error) {
            log.error('[CloudLevelService] Failed to delete level:', error);
            return false;
        }

        return true;
    }

    // =========================================
    // PUBLISHING
    // =========================================

    /**
     * Submit a level for review
     */
    public async submitForReview(id: string): Promise<boolean> {
        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return false;
        }

        const { error } = await client.rpc('submit_level_for_review', {
            level_id: id
        });

        if (error) {
            log.error('[CloudLevelService] Failed to submit for review:', error);
            return false;
        }

        return true;
    }

    /**
     * Withdraw a submission (move back to private)
     */
    public async withdrawSubmission(id: string): Promise<boolean> {
        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return false;
        }

        const { error } = await client
            .from('levels')
            .update({ level_type: 'private', submitted_at: null })
            .eq('id', id)
            .eq('level_type', 'pending_review');

        if (error) {
            log.error('[CloudLevelService] Failed to withdraw submission:', error);
            return false;
        }

        return true;
    }

    // =========================================
    // ADMIN FUNCTIONS
    // =========================================

    /**
     * Get levels pending review (admin only)
     */
    public async getPendingReviews(): Promise<CloudLevelEntry[]> {
        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return [];
        }

        const { data, error } = await client
            .from('levels')
            .select('*')
            .eq('level_type', 'pending_review')
            .order('submitted_at', { ascending: true });

        if (error) {
            log.error('[CloudLevelService] Failed to fetch pending reviews:', error);
            return [];
        }

        return (data || []).map(rowToEntry);
    }

    /**
     * Approve a level (admin only)
     */
    public async approveLevel(id: string, notes?: string): Promise<boolean> {
        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return false;
        }

        const { error } = await client.rpc('approve_level', {
            p_level_id: id,
            p_notes: notes || null
        });

        if (error) {
            log.error('[CloudLevelService] Failed to approve level:', error);
            return false;
        }

        return true;
    }

    /**
     * Reject a level (admin only)
     */
    public async rejectLevel(id: string, notes: string): Promise<boolean> {
        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return false;
        }

        const { error } = await client.rpc('reject_level', {
            p_level_id: id,
            p_notes: notes
        });

        if (error) {
            log.error('[CloudLevelService] Failed to reject level:', error);
            return false;
        }

        return true;
    }

    // =========================================
    // STATS
    // =========================================

    /**
     * Increment play count for a level
     */
    public async incrementPlayCount(id: string): Promise<void> {
        const client = SupabaseService.getInstance().getClient();
        if (!client) return;

        const { error } = await client.rpc('increment_play_count', {
            p_level_id: id
        });

        if (error) {
            log.error('[CloudLevelService] Failed to increment play count:', error);
        }
    }

    /**
     * Increment completion count for a level
     */
    public async incrementCompletionCount(id: string): Promise<void> {
        const client = SupabaseService.getInstance().getClient();
        if (!client) return;

        const { error } = await client.rpc('increment_completion_count', {
            p_level_id: id
        });

        if (error) {
            log.error('[CloudLevelService] Failed to increment completion count:', error);
        }
    }

    /**
     * Rate a level (1-5 stars)
     */
    public async rateLevel(levelId: string, rating: number): Promise<boolean> {
        if (rating < 1 || rating > 5) {
            log.error('[CloudLevelService] Rating must be between 1 and 5');
            return false;
        }

        const supabaseService = SupabaseService.getInstance();
        const client = await supabaseService.getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return false;
        }

        // Get internal user ID (UUID)
        const internalUserId = await supabaseService.ensureUserExists();
        if (!internalUserId) {
            log.warn('[CloudLevelService] No internal user ID available');
            return false;
        }

        const { error } = await client
            .from('level_ratings')
            .upsert({
                level_id: levelId,
                user_id: internalUserId,
                rating
            }, {
                onConflict: 'level_id,user_id'
            });

        if (error) {
            log.error('[CloudLevelService] Failed to rate level:', error);
            return false;
        }

        // TODO: Update avg_rating on levels table via trigger or here

        return true;
    }

    // =========================================
    // ADMIN LEVEL MANAGEMENT
    // =========================================

    /**
     * Get all levels for admin editing (requires canManageOfficial)
     */
    public async getAllLevelsForAdmin(): Promise<CloudLevelEntry[]> {
        const permissions = await this.getAdminPermissions();
        if (!permissions?.canManageOfficial) {
            log.warn('[CloudLevelService] Not authorized to view all levels');
            return [];
        }

        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return [];
        }

        const { data, error } = await client
            .from('levels')
            .select('*')
            .order('level_type', { ascending: true })
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            log.error('[CloudLevelService] Failed to fetch all levels:', error);
            return [];
        }

        return (data || []).map(rowToEntry);
    }

    /**
     * Update a level as admin (can update additional fields)
     */
    public async updateLevelAsAdmin(
        id: string,
        updates: {
            name?: string;
            slug?: string;
            description?: string;
            difficulty?: string;
            estimatedTime?: string;
            tags?: string[];
            config?: LevelConfig;
            missionBrief?: string[];
            sortOrder?: number;
            defaultLocked?: boolean;
            levelType?: string;
        }
    ): Promise<CloudLevelEntry | null> {
        const permissions = await this.getAdminPermissions();
        if (!permissions?.canManageOfficial) {
            log.warn('[CloudLevelService] Not authorized to update level as admin');
            return null;
        }

        const client = await SupabaseService.getInstance().getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] Not authenticated');
            return null;
        }

        const updateData: Record<string, unknown> = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.slug !== undefined) updateData.slug = updates.slug;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.difficulty !== undefined) updateData.difficulty = updates.difficulty;
        if (updates.estimatedTime !== undefined) updateData.estimated_time = updates.estimatedTime;
        if (updates.tags !== undefined) updateData.tags = updates.tags;
        if (updates.config !== undefined) updateData.config = updates.config;
        if (updates.missionBrief !== undefined) updateData.mission_brief = updates.missionBrief;
        if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
        if (updates.defaultLocked !== undefined) updateData.default_locked = updates.defaultLocked;
        if (updates.levelType !== undefined) updateData.level_type = updates.levelType;

        const { data, error } = await client
            .from('levels')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            log.error('[CloudLevelService] Failed to update level as admin:', error);
            return null;
        }

        return data ? rowToEntry(data) : null;
    }

    // =========================================
    // ADMIN STATUS CHECK
    // =========================================

    /**
     * Check if current user is an admin
     */
    public async isCurrentUserAdmin(): Promise<boolean> {
        const supabaseService = SupabaseService.getInstance();
        const client = await supabaseService.getAuthenticatedClient();
        if (!client) {
            return false;
        }

        // Get internal user ID (UUID)
        const internalUserId = await supabaseService.ensureUserExists();
        if (!internalUserId) {
            return false;
        }

        const { data, error } = await client
            .from('admins')
            .select('is_active')
            .eq('user_id', internalUserId)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return false;
        }

        return true;
    }

    /**
     * Get current user's admin permissions
     */
    public async getAdminPermissions(): Promise<{
        canReviewLevels: boolean;
        canManageAdmins: boolean;
        canManageOfficial: boolean;
        canViewAnalytics: boolean;
    } | null> {
        const supabaseService = SupabaseService.getInstance();
        const client = await supabaseService.getAuthenticatedClient();
        if (!client) {
            log.warn('[CloudLevelService] getAdminPermissions: No authenticated client');
            return null;
        }

        // Get internal user ID (UUID)
        const internalUserId = await supabaseService.ensureUserExists();
        if (!internalUserId) {
            log.warn('[CloudLevelService] getAdminPermissions: No internal user ID');
            return null;
        }

        log.info('[CloudLevelService] Checking admin permissions for user:', internalUserId);

        const { data, error } = await client
            .from('admins')
            .select('can_review_levels, can_manage_admins, can_manage_official, can_view_analytics')
            .eq('user_id', internalUserId)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            log.warn('[CloudLevelService] Admin query error:', error.message, error.code);
            return null;
        }

        if (!data) {
            log.warn('[CloudLevelService] No admin record found for user');
            return null;
        }

        log.info('[CloudLevelService] Admin permissions found:', data);
        return {
            canReviewLevels: data.can_review_levels,
            canManageAdmins: data.can_manage_admins,
            canManageOfficial: data.can_manage_official,
            canViewAnalytics: data.can_view_analytics,
        };
    }
}
