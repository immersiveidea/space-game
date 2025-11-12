import {LevelConfig} from "../config/levelConfig";

/**
 * Sync status for a level
 */
export enum SyncStatus {
    NotSynced = 'not_synced',
    Syncing = 'syncing',
    Synced = 'synced',
    Conflict = 'conflict',
    Error = 'error'
}

/**
 * Metadata for synced levels
 */
export interface SyncMetadata {
    lastSyncedAt?: Date;
    syncStatus: SyncStatus;
    cloudVersion?: string;
    localVersion?: string;
    syncError?: string;
}

/**
 * Interface for level storage providers (localStorage, cloud, etc.)
 */
export interface ILevelStorageProvider {
    /**
     * Get a level by ID
     */
    getLevel(levelId: string): Promise<LevelConfig | null>;

    /**
     * Save a level
     */
    saveLevel(levelId: string, config: LevelConfig): Promise<void>;

    /**
     * Delete a level
     */
    deleteLevel(levelId: string): Promise<boolean>;

    /**
     * List all level IDs
     */
    listLevels(): Promise<string[]>;

    /**
     * Check if provider is available/connected
     */
    isAvailable(): Promise<boolean>;

    /**
     * Get sync metadata for a level (if supported)
     */
    getSyncMetadata?(levelId: string): Promise<SyncMetadata | null>;
}

/**
 * LocalStorage implementation of level storage provider
 */
export class LocalStorageProvider implements ILevelStorageProvider {
    private storageKey: string;

    constructor(storageKey: string = 'space-game-custom-levels') {
        this.storageKey = storageKey;
    }

    async getLevel(levelId: string): Promise<LevelConfig | null> {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            return null;
        }

        try {
            const levelsArray: [string, LevelConfig][] = JSON.parse(stored);
            const found = levelsArray.find(([id]) => id === levelId);
            return found ? found[1] : null;
        } catch (error) {
            console.error('Failed to get level from localStorage:', error);
            return null;
        }
    }

    async saveLevel(levelId: string, config: LevelConfig): Promise<void> {
        const stored = localStorage.getItem(this.storageKey);
        let levelsArray: [string, LevelConfig][] = [];

        if (stored) {
            try {
                levelsArray = JSON.parse(stored);
            } catch (error) {
                console.error('Failed to parse localStorage data:', error);
            }
        }

        // Update or add level
        const existingIndex = levelsArray.findIndex(([id]) => id === levelId);
        if (existingIndex >= 0) {
            levelsArray[existingIndex] = [levelId, config];
        } else {
            levelsArray.push([levelId, config]);
        }

        localStorage.setItem(this.storageKey, JSON.stringify(levelsArray));
    }

    async deleteLevel(levelId: string): Promise<boolean> {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            return false;
        }

        try {
            const levelsArray: [string, LevelConfig][] = JSON.parse(stored);
            const newArray = levelsArray.filter(([id]) => id !== levelId);

            if (newArray.length === levelsArray.length) {
                return false; // Level not found
            }

            localStorage.setItem(this.storageKey, JSON.stringify(newArray));
            return true;
        } catch (error) {
            console.error('Failed to delete level from localStorage:', error);
            return false;
        }
    }

    async listLevels(): Promise<string[]> {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            return [];
        }

        try {
            const levelsArray: [string, LevelConfig][] = JSON.parse(stored);
            return levelsArray.map(([id]) => id);
        } catch (error) {
            console.error('Failed to list levels from localStorage:', error);
            return [];
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const testKey = '_storage_test_';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Cloud storage provider (stub for future implementation)
 *
 * Future implementation could use:
 * - Firebase Firestore
 * - AWS S3 + DynamoDB
 * - Custom backend API
 * - IPFS for decentralized storage
 */
export class CloudStorageProvider implements ILevelStorageProvider {
    private apiEndpoint: string;
    private authToken?: string;

    constructor(apiEndpoint: string, authToken?: string) {
        this.apiEndpoint = apiEndpoint;
        this.authToken = authToken;
    }

    async getLevel(_levelId: string): Promise<LevelConfig | null> {
        // TODO: Implement cloud fetch
        throw new Error('Cloud storage not yet implemented');
    }

    async saveLevel(_levelId: string, _config: LevelConfig): Promise<void> {
        // TODO: Implement cloud save
        throw new Error('Cloud storage not yet implemented');
    }

    async deleteLevel(_levelId: string): Promise<boolean> {
        // TODO: Implement cloud delete
        throw new Error('Cloud storage not yet implemented');
    }

    async listLevels(): Promise<string[]> {
        // TODO: Implement cloud list
        throw new Error('Cloud storage not yet implemented');
    }

    async isAvailable(): Promise<boolean> {
        // TODO: Implement cloud connectivity check
        return false;
    }

    async getSyncMetadata(_levelId: string): Promise<SyncMetadata | null> {
        // TODO: Implement sync metadata fetch
        throw new Error('Cloud storage not yet implemented');
    }

    /**
     * Authenticate with cloud service
     */
    async authenticate(token: string): Promise<boolean> {
        this.authToken = token;
        // TODO: Implement authentication
        return false;
    }

    /**
     * Sync local level to cloud
     */
    async syncToCloud(_levelId: string, _config: LevelConfig): Promise<SyncMetadata> {
        // TODO: Implement sync to cloud
        throw new Error('Cloud storage not yet implemented');
    }

    /**
     * Sync cloud level to local
     */
    async syncFromCloud(_levelId: string): Promise<LevelConfig> {
        // TODO: Implement sync from cloud
        throw new Error('Cloud storage not yet implemented');
    }

    /**
     * Resolve sync conflicts
     */
    async resolveConflict(
        _levelId: string,
        _strategy: 'use_local' | 'use_cloud' | 'merge'
    ): Promise<LevelConfig> {
        // TODO: Implement conflict resolution
        throw new Error('Cloud storage not yet implemented');
    }
}
