import {LevelConfig} from "../config/levelConfig";

/**
 * Level directory entry from directory.json manifest
 */
export interface LevelDirectoryEntry {
    id: string;
    name: string;
    description: string;
    version: string;
    levelPath: string;
    missionBrief?: string[];
    estimatedTime?: string;
    difficulty?: string;
    unlockRequirements?: string[];
    tags?: string[];
    defaultLocked?: boolean;
}

/**
 * Directory manifest structure
 */
export interface LevelDirectory {
    version: string;
    levels: LevelDirectoryEntry[];
}

/**
 * Registry entry combining directory info with loaded config
 */
export interface LevelRegistryEntry {
    directoryEntry: LevelDirectoryEntry;
    config: LevelConfig | null;  // null if not yet loaded
    isDefault: boolean;
    loadedAt?: Date;
}

const CUSTOM_LEVELS_KEY = 'space-game-custom-levels';

/**
 * Singleton registry for managing both default and custom levels
 * Always fetches fresh from network - no caching
 */
export class LevelRegistry {
    private static instance: LevelRegistry | null = null;

    private defaultLevels: Map<string, LevelRegistryEntry> = new Map();
    private customLevels: Map<string, LevelRegistryEntry> = new Map();
    private directoryManifest: LevelDirectory | null = null;
    private initialized: boolean = false;

    private constructor() {}

    public static getInstance(): LevelRegistry {
        if (!LevelRegistry.instance) {
            LevelRegistry.instance = new LevelRegistry();
        }
        return LevelRegistry.instance;
    }

    /**
     * Initialize the registry by loading directory and levels
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            await this.loadDirectory();
            this.loadCustomLevels();
            this.initialized = true;
            console.log('[LevelRegistry] Initialized with', this.defaultLevels.size, 'default levels');
        } catch (error) {
            console.error('[LevelRegistry] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Check if running in development mode (for cache-busting HTTP requests)
     */
    private isDevMode(): boolean {
        return window.location.hostname === 'localhost' ||
               window.location.hostname.includes('dev.') ||
               window.location.port !== '';
    }

    /**
     * Load the directory.json manifest (always fresh from network)
     */
    private async loadDirectory(): Promise<void> {
        try {
            // Add cache-busting in dev mode to avoid browser HTTP cache
            const cacheBuster = this.isDevMode() ? `?v=${Date.now()}` : '';
            const response = await fetch(`/levels/directory.json${cacheBuster}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch directory: ${response.status}`);
            }

            this.directoryManifest = await response.json();
            console.log('[LevelRegistry] Loaded directory with', this.directoryManifest?.levels?.length || 0, 'levels');

            this.populateDefaultLevelEntries();
        } catch (error) {
            console.error('[LevelRegistry] Failed to load directory:', error);
            throw new Error('Unable to load level directory. Please check your connection.');
        }
    }

    /**
     * Populate default level registry entries from directory
     */
    private populateDefaultLevelEntries(): void {
        if (!this.directoryManifest) {
            return;
        }

        this.defaultLevels.clear();

        for (const entry of this.directoryManifest.levels) {
            this.defaultLevels.set(entry.id, {
                directoryEntry: entry,
                config: null,  // Lazy load
                isDefault: true
            });
        }

        console.log('[LevelRegistry] Level IDs:', Array.from(this.defaultLevels.keys()));
    }

    /**
     * Load custom levels from localStorage
     */
    private loadCustomLevels(): void {
        this.customLevels.clear();

        const stored = localStorage.getItem(CUSTOM_LEVELS_KEY);
        if (!stored) {
            return;
        }

        try {
            const levelsArray: [string, LevelConfig][] = JSON.parse(stored);

            for (const [id, config] of levelsArray) {
                this.customLevels.set(id, {
                    directoryEntry: {
                        id,
                        name: config.metadata?.description || id,
                        description: config.metadata?.description || '',
                        version: config.version || '1.0',
                        levelPath: '',
                        difficulty: config.difficulty,
                        missionBrief: [],
                        defaultLocked: false
                    },
                    config,
                    isDefault: false,
                    loadedAt: new Date()
                });
            }
        } catch (error) {
            console.error('Failed to load custom levels from localStorage:', error);
        }
    }

    /**
     * Get a level config by ID (loads if not yet loaded)
     */
    public async getLevel(levelId: string): Promise<LevelConfig | null> {
        // Check default levels first
        const defaultEntry = this.defaultLevels.get(levelId);
        if (defaultEntry) {
            if (!defaultEntry.config) {
                await this.loadDefaultLevel(levelId);
            }
            return defaultEntry.config;
        }

        // Check custom levels
        const customEntry = this.customLevels.get(levelId);
        return customEntry?.config || null;
    }

    /**
     * Load a default level's config from JSON (always fresh from network)
     */
    private async loadDefaultLevel(levelId: string): Promise<void> {
        const entry = this.defaultLevels.get(levelId);
        if (!entry || entry.config) {
            return;
        }

        const levelPath = `/levels/${entry.directoryEntry.levelPath}`;

        try {
            // Add cache-busting in dev mode
            const cacheBuster = this.isDevMode() ? `?v=${Date.now()}` : '';
            const response = await fetch(`${levelPath}${cacheBuster}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch level: ${response.status}`);
            }

            entry.config = await response.json();
            entry.loadedAt = new Date();
            console.log('[LevelRegistry] Loaded level:', levelId);
        } catch (error) {
            console.error(`[LevelRegistry] Failed to load level ${levelId}:`, error);
            throw error;
        }
    }

    /**
     * Get all level registry entries (default + custom)
     */
    public getAllLevels(): Map<string, LevelRegistryEntry> {
        const all = new Map<string, LevelRegistryEntry>();

        for (const [id, entry] of this.defaultLevels) {
            all.set(id, entry);
        }

        for (const [id, entry] of this.customLevels) {
            all.set(id, entry);
        }

        return all;
    }

    /**
     * Get only default levels
     */
    public getDefaultLevels(): Map<string, LevelRegistryEntry> {
        return new Map(this.defaultLevels);
    }

    /**
     * Get only custom levels
     */
    public getCustomLevels(): Map<string, LevelRegistryEntry> {
        return new Map(this.customLevels);
    }

    /**
     * Save a custom level
     */
    public saveCustomLevel(levelId: string, config: LevelConfig): void {
        if (!config.metadata) {
            config.metadata = {
                author: 'Player',
                description: levelId
            };
        }

        if (config.metadata.type === 'default') {
            delete config.metadata.type;
        }

        this.customLevels.set(levelId, {
            directoryEntry: {
                id: levelId,
                name: config.metadata.description || levelId,
                description: config.metadata.description || '',
                version: config.version || '1.0',
                levelPath: '',
                difficulty: config.difficulty,
                missionBrief: [],
                defaultLocked: false
            },
            config,
            isDefault: false,
            loadedAt: new Date()
        });

        this.saveCustomLevelsToStorage();
    }

    /**
     * Delete a custom level
     */
    public deleteCustomLevel(levelId: string): boolean {
        const deleted = this.customLevels.delete(levelId);
        if (deleted) {
            this.saveCustomLevelsToStorage();
        }
        return deleted;
    }

    /**
     * Copy a default level to custom levels with a new ID
     */
    public async copyDefaultToCustom(defaultLevelId: string, newCustomId: string): Promise<boolean> {
        const config = await this.getLevel(defaultLevelId);
        if (!config) {
            return false;
        }

        const clonedConfig: LevelConfig = JSON.parse(JSON.stringify(config));

        clonedConfig.metadata = {
            ...clonedConfig.metadata,
            type: undefined,
            author: 'Player',
            description: `Copy of ${defaultLevelId}`,
            originalDefault: defaultLevelId
        };

        this.saveCustomLevel(newCustomId, clonedConfig);
        return true;
    }

    /**
     * Persist custom levels to localStorage
     */
    private saveCustomLevelsToStorage(): void {
        const levelsArray: [string, LevelConfig][] = [];

        for (const [id, entry] of this.customLevels) {
            if (entry.config) {
                levelsArray.push([id, entry.config]);
            }
        }

        localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(levelsArray));
    }

    /**
     * Force refresh all default levels from network
     */
    public async refreshDefaultLevels(): Promise<void> {
        // Clear in-memory configs
        for (const entry of this.defaultLevels.values()) {
            entry.config = null;
            entry.loadedAt = undefined;
        }

        // Reload directory
        await this.loadDirectory();
    }

    /**
     * Export custom levels as JSON for backup/sharing
     */
    public exportCustomLevels(): string {
        const levelsArray: [string, LevelConfig][] = [];

        for (const [id, entry] of this.customLevels) {
            if (entry.config) {
                levelsArray.push([id, entry.config]);
            }
        }

        return JSON.stringify(levelsArray, null, 2);
    }

    /**
     * Import custom levels from JSON
     */
    public importCustomLevels(jsonString: string): number {
        try {
            const levelsArray: [string, LevelConfig][] = JSON.parse(jsonString);
            let importCount = 0;

            for (const [id, config] of levelsArray) {
                this.saveCustomLevel(id, config);
                importCount++;
            }

            return importCount;
        } catch (error) {
            console.error('Failed to import custom levels:', error);
            throw new Error('Invalid custom levels JSON format');
        }
    }

    /**
     * Get directory manifest
     */
    public getDirectory(): LevelDirectory | null {
        return this.directoryManifest;
    }

    /**
     * Check if registry is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Reset registry state (for testing or force reload)
     */
    public reset(): void {
        for (const entry of this.defaultLevels.values()) {
            entry.config = null;
            entry.loadedAt = undefined;
        }

        this.initialized = false;
        this.directoryManifest = null;

        console.log('[LevelRegistry] Reset complete. Call initialize() to reload.');
    }
}
