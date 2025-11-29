import { LevelConfig } from "../config/levelConfig";
import { CloudLevelService, CloudLevelEntry } from "../../services/cloudLevelService";
import log from "../../core/logger";

/**
 * Singleton registry for managing levels from cloud (Supabase)
 */
export class LevelRegistry {
    private static instance: LevelRegistry | null = null;
    private levels: Map<string, CloudLevelEntry> = new Map();
    private initialized: boolean = false;

    private constructor() {}

    public static getInstance(): LevelRegistry {
        if (!LevelRegistry.instance) {
            LevelRegistry.instance = new LevelRegistry();
        }
        return LevelRegistry.instance;
    }

    /**
     * Initialize the registry by loading levels from cloud
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        const cloudService = CloudLevelService.getInstance();
        if (!cloudService.isAvailable()) {
            throw new Error('Cloud service not available - cannot load levels');
        }

        const entries = await cloudService.getOfficialLevels();
        for (const entry of entries) {
            const key = entry.slug || entry.id;
            this.levels.set(key, entry);
        }

        this.initialized = true;
        log.info('[LevelRegistry] Loaded', this.levels.size, 'levels from cloud:',
            Array.from(this.levels.keys()));
    }

    /**
     * Get a level config by ID/slug
     */
    public getLevel(levelId: string): LevelConfig | null {
        return this.levels.get(levelId)?.config || null;
    }

    /**
     * Get full level entry by ID/slug
     */
    public getLevelEntry(levelId: string): CloudLevelEntry | null {
        return this.levels.get(levelId) || null;
    }

    /**
     * Get all levels
     */
    public getAllLevels(): Map<string, CloudLevelEntry> {
        return new Map(this.levels);
    }

    /**
     * Check if registry is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Reset registry state
     */
    public reset(): void {
        this.levels.clear();
        this.initialized = false;
        log.info('[LevelRegistry] Reset complete. Call initialize() to reload.');
    }
}
