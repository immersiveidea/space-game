import { SupabaseService } from './supabaseService';
import log from '../core/logger';

/**
 * Hint entry from the database
 */
export interface HintEntry {
    id: string;
    levelId: string;
    eventType: 'ship_status' | 'asteroid_destroyed' | 'collision';
    eventConfig: Record<string, unknown>;
    audioUrl: string;
    playMode: 'once' | 'always';
    sortOrder: number;
}

/**
 * Database row format (snake_case)
 */
interface HintRow {
    id: string;
    level_id: string;
    event_type: string;
    event_config: Record<string, unknown>;
    audio_url: string;
    play_mode: string;
    sort_order: number;
}

/**
 * Convert database row to HintEntry
 */
function rowToEntry(row: HintRow): HintEntry {
    return {
        id: row.id,
        levelId: row.level_id,
        eventType: row.event_type as HintEntry['eventType'],
        eventConfig: row.event_config || {},
        audioUrl: row.audio_url,
        playMode: row.play_mode as HintEntry['playMode'],
        sortOrder: row.sort_order,
    };
}

/**
 * Service for fetching level hints from Supabase
 */
export class HintService {
    private static _instance: HintService;

    private constructor() {}

    public static getInstance(): HintService {
        if (!HintService._instance) {
            HintService._instance = new HintService();
        }
        return HintService._instance;
    }

    /**
     * Get all hints for a level, ordered by sort_order
     */
    public async getHintsForLevel(levelId: string): Promise<HintEntry[]> {
        const client = SupabaseService.getInstance().getClient();
        if (!client) {
            log.warn('[HintService] Supabase not configured');
            return [];
        }

        const { data, error } = await client
            .from('hints')
            .select('*')
            .eq('level_id', levelId)
            .order('sort_order', { ascending: true });

        if (error) {
            log.error('[HintService] Failed to fetch hints:', error);
            return [];
        }

        log.info('[HintService] Loaded', data?.length || 0, 'hints for level', levelId);
        return (data || []).map(rowToEntry);
    }
}
