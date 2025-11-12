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
const CACHE_NAME = 'space-game-levels-v1';
const CACHED_VERSION_KEY = 'space-game-levels-cached-version';

/**
 * Singleton registry for managing both default and custom levels
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
        console.log('[LevelRegistry] initialize() called, initialized =', this.initialized);

        if (this.initialized) {
            console.log('[LevelRegistry] Already initialized, skipping');
            return;
        }

        try {
            console.log('[LevelRegistry] Loading directory manifest...');
            // Load directory manifest
            await this.loadDirectory();
            console.log('[LevelRegistry] Directory loaded, entries:', this.directoryManifest?.levels.length);

            console.log('[LevelRegistry] Loading custom levels from localStorage...');
            // Load custom levels from localStorage
            this.loadCustomLevels();
            console.log('[LevelRegistry] Custom levels loaded:', this.customLevels.size);

            this.initialized = true;
            console.log('[LevelRegistry] Initialization complete!');
        } catch (error) {
            console.error('[LevelRegistry] Failed to initialize level registry:', error);
            throw error;
        }
    }

    /**
     * Load the directory.json manifest
     */
    private async loadDirectory(): Promise<void> {
        try {
            console.log('[LevelRegistry] Attempting to fetch /levels/directory.json');

            // First, fetch from network to get the latest version
            console.log('[LevelRegistry] Fetching from network to check version...');
            const response = await fetch('/levels/directory.json');
            console.log('[LevelRegistry] Fetch response status:', response.status, response.ok);

            if (!response.ok) {
                // If network fails, try to use cached version as fallback
                console.warn('[LevelRegistry] Network fetch failed, trying cache...');
                const cached = await this.getCachedResource('/levels/directory.json');
                if (cached) {
                    console.log('[LevelRegistry] Using cached directory as fallback');
                    this.directoryManifest = cached;
                    this.populateDefaultLevelEntries();
                    return;
                }
                throw new Error(`Failed to fetch directory: ${response.status}`);
            }

            const networkManifest = await response.json();
            console.log('[LevelRegistry] Directory JSON parsed:', networkManifest);

            // Check if version changed
            const cachedVersion = localStorage.getItem(CACHED_VERSION_KEY);
            const currentVersion = networkManifest.version;

            if (cachedVersion && cachedVersion !== currentVersion) {
                console.log('[LevelRegistry] Version changed from', cachedVersion, 'to', currentVersion, '- invalidating cache');
                await this.invalidateCache();
            } else {
                console.log('[LevelRegistry] Version unchanged or first load:', currentVersion);
            }

            // Update cached version
            localStorage.setItem(CACHED_VERSION_KEY, currentVersion);

            // Store the manifest
            this.directoryManifest = networkManifest;

            // Cache the directory
            await this.cacheResource('/levels/directory.json', this.directoryManifest);

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
                        levelPath: '', // Not applicable for custom
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
     * Load a default level's config from JSON
     */
    private async loadDefaultLevel(levelId: string): Promise<void> {
        const entry = this.defaultLevels.get(levelId);
        if (!entry || entry.config) {
            return; // Already loaded or doesn't exist
        }

        try {
            const levelPath = `/levels/${entry.directoryEntry.levelPath}`;

            // Try cache first
            const cached = await this.getCachedResource(levelPath);
            if (cached) {
                entry.config = cached;
                entry.loadedAt = new Date();
                return;
            }

            // Fetch from network
            const response = await fetch(levelPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch level: ${response.status}`);
            }

            const config: LevelConfig = await response.json();

            // Cache the level
            await this.cacheResource(levelPath, config);

            entry.config = config;
            entry.loadedAt = new Date();
        } catch (error) {
            console.error(`Failed to load default level ${levelId}:`, error);
            throw error;
        }
    }

    /**
     * Get all level registry entries (default + custom)
     */
    public getAllLevels(): Map<string, LevelRegistryEntry> {
        const all = new Map<string, LevelRegistryEntry>();

        // Add defaults
        for (const [id, entry] of this.defaultLevels) {
            all.set(id, entry);
        }

        // Add customs
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
        // Ensure metadata exists
        if (!config.metadata) {
            config.metadata = {
                author: 'Player',
                description: levelId
            };
        }

        // Remove 'default' type if present
        if (config.metadata.type === 'default') {
            delete config.metadata.type;
        }

        // Add/update in memory
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

        // Persist to localStorage
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

        // Deep clone the config
        const clonedConfig: LevelConfig = JSON.parse(JSON.stringify(config));

        // Update metadata
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
     * Get a resource from cache
     */
    private async getCachedResource(path: string): Promise<any | null> {
        if (!('caches' in window)) {
            return null;
        }

        try {
            const cache = await caches.open(CACHE_NAME);
            const response = await cache.match(path);

            if (response) {
                return await response.json();
            }
        } catch (error) {
            console.warn('Cache read failed:', error);
        }

        return null;
    }

    /**
     * Cache a resource
     */
    private async cacheResource(path: string, data: any): Promise<void> {
        if (!('caches' in window)) {
            return;
        }

        try {
            const cache = await caches.open(CACHE_NAME);
            const response = new Response(JSON.stringify(data), {
                headers: {'Content-Type': 'application/json'}
            });
            await cache.put(path, response);
        } catch (error) {
            console.warn('Cache write failed:', error);
        }
    }

    /**
     * Invalidate the entire cache (called when version changes)
     */
    private async invalidateCache(): Promise<void> {
        console.log('[LevelRegistry] Invalidating cache...');
        if ('caches' in window) {
            await caches.delete(CACHE_NAME);
        }

        // Clear loaded configs
        for (const entry of this.defaultLevels.values()) {
            entry.config = null;
            entry.loadedAt = undefined;
        }
        console.log('[LevelRegistry] Cache invalidated');
    }

    /**
     * Force refresh all default levels from network
     */
    public async refreshDefaultLevels(): Promise<void> {
        // Clear cache
        await this.invalidateCache();

        // Clear cached version to force re-check
        localStorage.removeItem(CACHED_VERSION_KEY);

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
}
