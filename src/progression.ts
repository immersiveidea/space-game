/**
 * Progression tracking system for level completion and feature unlocks
 */

export interface LevelProgress {
    levelName: string;
    completed: boolean;
    completedAt?: string; // ISO timestamp
    bestTime?: number; // Best completion time in seconds
    bestAccuracy?: number; // Best accuracy percentage
    playCount: number;
}

export interface ProgressionData {
    version: string;
    completedLevels: Map<string, LevelProgress>;
    editorUnlocked: boolean;
    firstPlayDate?: string;
    lastPlayDate?: string;
}

const STORAGE_KEY = 'space-game-progress';
const PROGRESSION_VERSION = '1.0';
const EDITOR_UNLOCK_REQUIREMENT = 3; // Complete 3 default levels to unlock editor

/**
 * Progression manager - tracks level completion and unlocks
 */
export class ProgressionManager {
    private static _instance: ProgressionManager;
    private _data: ProgressionData;

    private constructor() {
        this._data = this.loadProgress();
    }

    public static getInstance(): ProgressionManager {
        if (!ProgressionManager._instance) {
            ProgressionManager._instance = new ProgressionManager();
        }
        return ProgressionManager._instance;
    }

    /**
     * Load progression data from localStorage
     */
    private loadProgress(): ProgressionData {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Convert completedLevels array back to Map
                const completedLevels = new Map<string, LevelProgress>(
                    parsed.completedLevels || []
                );
                return {
                    version: parsed.version || PROGRESSION_VERSION,
                    completedLevels,
                    editorUnlocked: parsed.editorUnlocked || false,
                    firstPlayDate: parsed.firstPlayDate,
                    lastPlayDate: parsed.lastPlayDate
                };
            }
        } catch (error) {
            console.error('Error loading progression data:', error);
        }

        // Return fresh progression data
        return {
            version: PROGRESSION_VERSION,
            completedLevels: new Map(),
            editorUnlocked: false,
            firstPlayDate: new Date().toISOString()
        };
    }

    /**
     * Save progression data to localStorage
     */
    private saveProgress(): void {
        try {
            // Convert Map to array for JSON serialization
            const toSave = {
                ...this._data,
                completedLevels: Array.from(this._data.completedLevels.entries()),
                lastPlayDate: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (error) {
            console.error('Error saving progression data:', error);
        }
    }

    /**
     * Mark a level as completed with optional stats
     */
    public markLevelComplete(
        levelName: string,
        stats?: {
            completionTime?: number;
            accuracy?: number;
        }
    ): void {
        const existing = this._data.completedLevels.get(levelName);
        const now = new Date().toISOString();

        const progress: LevelProgress = {
            levelName,
            completed: true,
            completedAt: now,
            bestTime: stats?.completionTime,
            bestAccuracy: stats?.accuracy,
            playCount: (existing?.playCount || 0) + 1
        };

        // Update best time if this is better
        if (existing?.bestTime && stats?.completionTime) {
            progress.bestTime = Math.min(existing.bestTime, stats.completionTime);
        }

        // Update best accuracy if this is better
        if (existing?.bestAccuracy && stats?.accuracy) {
            progress.bestAccuracy = Math.max(existing.bestAccuracy, stats.accuracy);
        }

        this._data.completedLevels.set(levelName, progress);

        // Check if editor should be unlocked
        this.checkEditorUnlock();

        this.saveProgress();
    }

    /**
     * Record that a level was started (for play count)
     */
    public recordLevelStart(levelName: string): void {
        const existing = this._data.completedLevels.get(levelName);
        if (!existing) {
            this._data.completedLevels.set(levelName, {
                levelName,
                completed: false,
                playCount: 1
            });
        }
        this.saveProgress();
    }

    /**
     * Check if a level has been completed
     */
    public isLevelComplete(levelName: string): boolean {
        return this._data.completedLevels.get(levelName)?.completed || false;
    }

    /**
     * Get progress data for a specific level
     */
    public getLevelProgress(levelName: string): LevelProgress | undefined {
        return this._data.completedLevels.get(levelName);
    }

    /**
     * Get all completed default levels
     */
    public getCompletedDefaultLevels(): string[] {
        const defaultLevels = this.getDefaultLevelNames();
        return defaultLevels.filter(name => this.isLevelComplete(name));
    }

    /**
     * Get the next incomplete default level
     */
    public getNextLevel(): string | null {
        const defaultLevels = this.getDefaultLevelNames();
        for (const levelName of defaultLevels) {
            if (!this.isLevelComplete(levelName)) {
                return levelName;
            }
        }
        return null; // All levels completed
    }

    /**
     * Get list of default level names in order
     */
    private getDefaultLevelNames(): string[] {
        return [
            'Tutorial: Asteroid Field',
            'Rescue Mission',
            'Deep Space Patrol',
            'Enemy Territory',
            'The Gauntlet',
            'Final Challenge'
        ];
    }

    /**
     * Check if editor should be unlocked based on completion
     */
    private checkEditorUnlock(): void {
        const completedCount = this.getCompletedDefaultLevels().length;
        if (completedCount >= EDITOR_UNLOCK_REQUIREMENT && !this._data.editorUnlocked) {
            this._data.editorUnlocked = true;
            console.log(`🎉 Editor unlocked! (${completedCount} levels completed)`);
        }
    }

    /**
     * Check if the level editor is unlocked
     */
    public isEditorUnlocked(): boolean {
        return this._data.editorUnlocked;
    }

    /**
     * Get count of completed default levels
     */
    public getCompletedCount(): number {
        return this.getCompletedDefaultLevels().length;
    }

    /**
     * Get total count of default levels
     */
    public getTotalDefaultLevels(): number {
        return this.getDefaultLevelNames().length;
    }

    /**
     * Get completion percentage
     */
    public getCompletionPercentage(): number {
        const total = this.getTotalDefaultLevels();
        const completed = this.getCompletedCount();
        return total > 0 ? (completed / total) * 100 : 0;
    }

    /**
     * Reset all progression (for testing or user request)
     */
    public reset(): void {
        this._data = {
            version: PROGRESSION_VERSION,
            completedLevels: new Map(),
            editorUnlocked: false,
            firstPlayDate: new Date().toISOString()
        };
        this.saveProgress();
    }

    /**
     * Force unlock editor (admin/testing)
     */
    public forceUnlockEditor(): void {
        this._data.editorUnlocked = true;
        this.saveProgress();
    }

    /**
     * Get all progression data (for display/debugging)
     */
    public getAllProgress(): ProgressionData {
        return { ...this._data };
    }
}
