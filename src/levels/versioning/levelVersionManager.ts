import {LevelDirectory, LevelDirectoryEntry} from "../storage/levelRegistry";

/**
 * Tracked version information for a level
 */
export interface LevelVersionInfo {
    levelId: string;
    loadedVersion: string;
    loadedAt: Date;
    manifestVersion?: string; // Latest version from directory
}

/**
 * Version comparison result
 */
export interface VersionComparison {
    levelId: string;
    currentVersion: string;
    latestVersion: string;
    isOutdated: boolean;
    changelog?: string;
}

const VERSION_STORAGE_KEY = 'space-game-level-versions';

/**
 * Manages level version tracking and update detection
 */
export class LevelVersionManager {
    private static instance: LevelVersionManager | null = null;

    private versionMap: Map<string, LevelVersionInfo> = new Map();

    private constructor() {
        this.loadVersions();
    }

    public static getInstance(): LevelVersionManager {
        if (!LevelVersionManager.instance) {
            LevelVersionManager.instance = new LevelVersionManager();
        }
        return LevelVersionManager.instance;
    }

    /**
     * Load version tracking from localStorage
     */
    private loadVersions(): void {
        const stored = localStorage.getItem(VERSION_STORAGE_KEY);
        if (!stored) {
            return;
        }

        try {
            const versionsArray: [string, LevelVersionInfo][] = JSON.parse(stored);

            for (const [id, info] of versionsArray) {
                // Parse date string back to Date object
                if (info.loadedAt && typeof info.loadedAt === 'string') {
                    info.loadedAt = new Date(info.loadedAt);
                }
                this.versionMap.set(id, info);
            }
        } catch (error) {
            console.error('Failed to load level versions:', error);
        }
    }

    /**
     * Save version tracking to localStorage
     */
    private saveVersions(): void {
        const versionsArray = Array.from(this.versionMap.entries());
        localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(versionsArray));
    }

    /**
     * Record that a level was loaded with a specific version
     */
    public recordLevelLoaded(levelId: string, version: string): void {
        const info: LevelVersionInfo = {
            levelId,
            loadedVersion: version,
            loadedAt: new Date()
        };

        this.versionMap.set(levelId, info);
        this.saveVersions();
    }

    /**
     * Update manifest versions from directory
     */
    public updateManifestVersions(directory: LevelDirectory): void {
        for (const entry of directory.levels) {
            const existing = this.versionMap.get(entry.id);
            if (existing) {
                existing.manifestVersion = entry.version;
            } else {
                // First time seeing this level
                this.versionMap.set(entry.id, {
                    levelId: entry.id,
                    loadedVersion: '',  // Not yet loaded
                    loadedAt: new Date(),
                    manifestVersion: entry.version
                });
            }
        }

        this.saveVersions();
    }

    /**
     * Check if a level has an update available
     */
    public hasUpdate(levelId: string): boolean {
        const info = this.versionMap.get(levelId);
        if (!info || !info.manifestVersion || !info.loadedVersion) {
            return false;
        }

        return this.compareVersions(info.loadedVersion, info.manifestVersion) < 0;
    }

    /**
     * Get version comparison for a level
     */
    public getVersionComparison(levelId: string): VersionComparison | null {
        const info = this.versionMap.get(levelId);
        if (!info || !info.manifestVersion) {
            return null;
        }

        const currentVersion = info.loadedVersion || '0.0';
        const latestVersion = info.manifestVersion;
        const isOutdated = this.compareVersions(currentVersion, latestVersion) < 0;

        return {
            levelId,
            currentVersion,
            latestVersion,
            isOutdated
        };
    }

    /**
     * Get all levels with available updates
     */
    public getUpdatableLevels(): VersionComparison[] {
        const updatable: VersionComparison[] = [];

        for (const [levelId, info] of this.versionMap) {
            if (info.manifestVersion && info.loadedVersion) {
                const comparison = this.getVersionComparison(levelId);
                if (comparison && comparison.isOutdated) {
                    updatable.push(comparison);
                }
            }
        }

        return updatable;
    }

    /**
     * Get version info for a level
     */
    public getVersionInfo(levelId: string): LevelVersionInfo | undefined {
        return this.versionMap.get(levelId);
    }

    /**
     * Mark a level as updated (user accepted the new version)
     */
    public markAsUpdated(levelId: string, newVersion: string): void {
        const info = this.versionMap.get(levelId);
        if (info) {
            info.loadedVersion = newVersion;
            info.loadedAt = new Date();
            this.saveVersions();
        }
    }

    /**
     * Compare two semantic version strings
     * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
     */
    private compareVersions(v1: string, v2: string): number {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        const maxLength = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < maxLength; i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;

            if (part1 < part2) return -1;
            if (part1 > part2) return 1;
        }

        return 0;
    }

    /**
     * Clear all version tracking (for testing/reset)
     */
    public clearAll(): void {
        this.versionMap.clear();
        localStorage.removeItem(VERSION_STORAGE_KEY);
    }

    /**
     * Get summary of version statuses
     */
    public getVersionSummary(): {
        total: number;
        tracked: number;
        updatable: number;
        upToDate: number;
    } {
        let tracked = 0;
        let updatable = 0;
        let upToDate = 0;

        for (const info of this.versionMap.values()) {
            if (info.loadedVersion) {
                tracked++;

                if (info.manifestVersion) {
                    if (this.compareVersions(info.loadedVersion, info.manifestVersion) < 0) {
                        updatable++;
                    } else {
                        upToDate++;
                    }
                }
            }
        }

        return {
            total: this.versionMap.size,
            tracked,
            updatable,
            upToDate
        };
    }

    /**
     * Build changelog text for version updates
     */
    public static buildChangelog(directoryEntry: LevelDirectoryEntry): string {
        // In the future, this could fetch from a changelog file or API
        // For now, generate a simple message
        return `Level updated to version ${directoryEntry.version}. Check for improvements and changes!`;
    }

    /**
     * Check if this is the first time loading any levels
     */
    public isFirstRun(): boolean {
        return this.versionMap.size === 0;
    }
}
