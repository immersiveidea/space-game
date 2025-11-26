import { SupabaseService } from './supabaseService';
import { AuthService } from './authService';
import type { GameResult } from './gameResultsService';

/**
 * Represents a leaderboard entry from Supabase
 */
export interface CloudLeaderboardEntry {
    id: string;
    user_id: string;
    player_name: string;
    level_id: string;
    level_name: string;
    completed: boolean;
    end_reason: string;
    game_time_seconds: number;
    asteroids_destroyed: number;
    total_asteroids: number;
    accuracy: number;
    hull_damage_taken: number;
    fuel_consumed: number;
    final_score: number;
    star_rating: number;
    created_at: string;
}

/**
 * Service for interacting with the cloud-based leaderboard via Supabase
 */
export class CloudLeaderboardService {
    private static _instance: CloudLeaderboardService;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): CloudLeaderboardService {
        if (!CloudLeaderboardService._instance) {
            CloudLeaderboardService._instance = new CloudLeaderboardService();
        }
        return CloudLeaderboardService._instance;
    }

    /**
     * Check if cloud leaderboard is available
     */
    public isAvailable(): boolean {
        return SupabaseService.getInstance().isConfigured();
    }

    /**
     * Submit a game result to the cloud leaderboard
     * Requires authenticated user
     */
    public async submitScore(result: GameResult): Promise<boolean> {
        const supabase = SupabaseService.getInstance();

        if (!supabase.isConfigured()) {
            console.warn('[CloudLeaderboardService] Supabase not configured');
            return false;
        }

        // Get user ID from Auth0
        const authService = AuthService.getInstance();
        const user = authService.getUser();

        if (!user?.sub) {
            console.warn('[CloudLeaderboardService] No user sub claim - user not logged in');
            return false;
        }

        console.log('[CloudLeaderboardService] Submitting score for user:', user.sub);

        // Get authenticated client for insert (requires RLS)
        const client = await supabase.getAuthenticatedClient();
        if (!client) {
            console.warn('[CloudLeaderboardService] Not authenticated - cannot submit score');
            return false;
        }

        const entry = {
            user_id: user.sub,
            player_name: result.playerName,
            level_id: result.levelId,
            level_name: result.levelName,
            completed: result.completed,
            end_reason: result.endReason,
            game_time_seconds: result.gameTimeSeconds,
            asteroids_destroyed: result.asteroidsDestroyed,
            total_asteroids: result.totalAsteroids,
            accuracy: result.accuracy,
            hull_damage_taken: result.hullDamageTaken,
            fuel_consumed: result.fuelConsumed,
            final_score: result.finalScore,
            star_rating: result.starRating
        };

        console.log('[CloudLeaderboardService] Inserting entry:', entry);

        const { data, error } = await client
            .from('leaderboard')
            .insert(entry)
            .select();

        if (error) {
            console.error('[CloudLeaderboardService] Failed to submit score:', error);
            console.error('[CloudLeaderboardService] Error details:', JSON.stringify(error, null, 2));
            return false;
        }

        console.log('[CloudLeaderboardService] Score submitted successfully:', data);
        return true;
    }

    /**
     * Fetch the global leaderboard (top scores across all players)
     */
    public async getGlobalLeaderboard(limit: number = 20): Promise<CloudLeaderboardEntry[]> {
        const supabase = SupabaseService.getInstance();
        const client = supabase.getClient();

        if (!client) {
            console.warn('[CloudLeaderboardService] Supabase not configured');
            return [];
        }

        const { data, error } = await client
            .from('leaderboard')
            .select('*')
            .order('final_score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[CloudLeaderboardService] Failed to fetch leaderboard:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Fetch a user's personal scores
     */
    public async getUserScores(userId: string, limit: number = 10): Promise<CloudLeaderboardEntry[]> {
        const supabase = SupabaseService.getInstance();
        const client = supabase.getClient();

        if (!client) {
            console.warn('[CloudLeaderboardService] Supabase not configured');
            return [];
        }

        const { data, error } = await client
            .from('leaderboard')
            .select('*')
            .eq('user_id', userId)
            .order('final_score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[CloudLeaderboardService] Failed to fetch user scores:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Fetch leaderboard for a specific level
     */
    public async getLevelLeaderboard(levelId: string, limit: number = 20): Promise<CloudLeaderboardEntry[]> {
        const supabase = SupabaseService.getInstance();
        const client = supabase.getClient();

        if (!client) {
            console.warn('[CloudLeaderboardService] Supabase not configured');
            return [];
        }

        const { data, error } = await client
            .from('leaderboard')
            .select('*')
            .eq('level_id', levelId)
            .order('final_score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[CloudLeaderboardService] Failed to fetch level leaderboard:', error);
            return [];
        }

        return data || [];
    }
}
