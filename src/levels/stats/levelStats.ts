/**
 * Completion record for a single play-through
 */
export interface LevelCompletion {
    timestamp: Date;
    completionTimeSeconds: number;
    score?: number;
    survived: boolean; // false if player died/quit
}

/**
 * Aggregated statistics for a level
 */
export interface LevelStatistics {
    levelId: string;
    firstPlayed?: Date;
    lastPlayed?: Date;
    completions: LevelCompletion[];
    totalAttempts: number; // Including incomplete attempts
    totalCompletions: number; // Only successful completions
    bestTimeSeconds?: number;
    averageTimeSeconds?: number;
    bestScore?: number;
    averageScore?: number;
    completionRate: number; // percentage (0-100)
    difficultyRating?: number; // 1-5 stars, user-submitted
}

const STATS_STORAGE_KEY = 'space-game-level-stats';

/**
 * Manages level performance statistics and ratings
 */
export class LevelStatsManager {
    private static instance: LevelStatsManager | null = null;

    private statsMap: Map<string, LevelStatistics> = new Map();

    private constructor() {
        this.loadStats();
    }

    public static getInstance(): LevelStatsManager {
        if (!LevelStatsManager.instance) {
            LevelStatsManager.instance = new LevelStatsManager();
        }
        return LevelStatsManager.instance;
    }

    /**
     * Load stats from localStorage
     */
    private loadStats(): void {
        const stored = localStorage.getItem(STATS_STORAGE_KEY);
        if (!stored) {
            return;
        }

        try {
            const statsArray: [string, LevelStatistics][] = JSON.parse(stored);

            for (const [id, stats] of statsArray) {
                // Parse date strings back to Date objects
                if (stats.firstPlayed && typeof stats.firstPlayed === 'string') {
                    stats.firstPlayed = new Date(stats.firstPlayed);
                }
                if (stats.lastPlayed && typeof stats.lastPlayed === 'string') {
                    stats.lastPlayed = new Date(stats.lastPlayed);
                }

                // Parse completion timestamps
                stats.completions = stats.completions.map(c => ({
                    ...c,
                    timestamp: typeof c.timestamp === 'string' ? new Date(c.timestamp) : c.timestamp
                }));

                this.statsMap.set(id, stats);
            }
        } catch (error) {
            console.error('Failed to load level stats:', error);
        }
    }

    /**
     * Save stats to localStorage
     */
    private saveStats(): void {
        const statsArray = Array.from(this.statsMap.entries());
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(statsArray));
    }

    /**
     * Get statistics for a level
     */
    public getStats(levelId: string): LevelStatistics | undefined {
        return this.statsMap.get(levelId);
    }

    /**
     * Initialize stats for a level if not exists
     */
    private ensureStatsExist(levelId: string): LevelStatistics {
        let stats = this.statsMap.get(levelId);
        if (!stats) {
            stats = {
                levelId,
                completions: [],
                totalAttempts: 0,
                totalCompletions: 0,
                completionRate: 0
            };
            this.statsMap.set(levelId, stats);
        }
        return stats;
    }

    /**
     * Record that a level was started (attempt)
     */
    public recordAttempt(levelId: string): void {
        const stats = this.ensureStatsExist(levelId);
        stats.totalAttempts++;

        const now = new Date();
        if (!stats.firstPlayed) {
            stats.firstPlayed = now;
        }
        stats.lastPlayed = now;

        this.recalculateStats(stats);
        this.saveStats();
    }

    /**
     * Record a level completion
     */
    public recordCompletion(
        levelId: string,
        completionTimeSeconds: number,
        score?: number,
        survived: boolean = true
    ): void {
        const stats = this.ensureStatsExist(levelId);

        const completion: LevelCompletion = {
            timestamp: new Date(),
            completionTimeSeconds,
            score,
            survived
        };

        stats.completions.push(completion);

        if (survived) {
            stats.totalCompletions++;
        }

        const now = new Date();
        if (!stats.firstPlayed) {
            stats.firstPlayed = now;
        }
        stats.lastPlayed = now;

        this.recalculateStats(stats);
        this.saveStats();
    }

    /**
     * Set difficulty rating for a level (1-5 stars)
     */
    public setDifficultyRating(levelId: string, rating: number): void {
        if (rating < 1 || rating > 5) {
            console.warn('Rating must be between 1 and 5');
            return;
        }

        const stats = this.ensureStatsExist(levelId);
        stats.difficultyRating = rating;
        this.saveStats();
    }

    /**
     * Recalculate aggregated statistics
     */
    private recalculateStats(stats: LevelStatistics): void {
        const successfulCompletions = stats.completions.filter(c => c.survived);

        // Completion rate
        stats.completionRate = stats.totalAttempts > 0
            ? (stats.totalCompletions / stats.totalAttempts) * 100
            : 0;

        // Time statistics
        if (successfulCompletions.length > 0) {
            const times = successfulCompletions.map(c => c.completionTimeSeconds);
            stats.bestTimeSeconds = Math.min(...times);
            stats.averageTimeSeconds = times.reduce((a, b) => a + b, 0) / times.length;
        } else {
            stats.bestTimeSeconds = undefined;
            stats.averageTimeSeconds = undefined;
        }

        // Score statistics
        const completionsWithScore = successfulCompletions.filter(c => c.score !== undefined);
        if (completionsWithScore.length > 0) {
            const scores = completionsWithScore.map(c => c.score!);
            stats.bestScore = Math.max(...scores);
            stats.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        } else {
            stats.bestScore = undefined;
            stats.averageScore = undefined;
        }
    }

    /**
     * Get all stats
     */
    public getAllStats(): Map<string, LevelStatistics> {
        return new Map(this.statsMap);
    }

    /**
     * Get stats for multiple levels
     */
    public getStatsForLevels(levelIds: string[]): Map<string, LevelStatistics> {
        const result = new Map<string, LevelStatistics>();
        for (const id of levelIds) {
            const stats = this.statsMap.get(id);
            if (stats) {
                result.set(id, stats);
            }
        }
        return result;
    }

    /**
     * Get top N fastest completions for a level
     */
    public getTopCompletions(levelId: string, limit: number = 10): LevelCompletion[] {
        const stats = this.statsMap.get(levelId);
        if (!stats) {
            return [];
        }

        return stats.completions
            .filter(c => c.survived)
            .sort((a, b) => a.completionTimeSeconds - b.completionTimeSeconds)
            .slice(0, limit);
    }

    /**
     * Get recent completions for a level
     */
    public getRecentCompletions(levelId: string, limit: number = 10): LevelCompletion[] {
        const stats = this.statsMap.get(levelId);
        if (!stats) {
            return [];
        }

        return [...stats.completions]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Delete stats for a level
     */
    public deleteStats(levelId: string): boolean {
        const deleted = this.statsMap.delete(levelId);
        if (deleted) {
            this.saveStats();
        }
        return deleted;
    }

    /**
     * Clear all stats (for testing/reset)
     */
    public clearAll(): void {
        this.statsMap.clear();
        localStorage.removeItem(STATS_STORAGE_KEY);
    }

    /**
     * Export stats as JSON
     */
    public exportStats(): string {
        const statsArray = Array.from(this.statsMap.entries());
        return JSON.stringify(statsArray, null, 2);
    }

    /**
     * Import stats from JSON
     */
    public importStats(jsonString: string): number {
        try {
            const statsArray: [string, LevelStatistics][] = JSON.parse(jsonString);
            let importCount = 0;

            for (const [id, stats] of statsArray) {
                // Parse dates
                if (stats.firstPlayed && typeof stats.firstPlayed === 'string') {
                    stats.firstPlayed = new Date(stats.firstPlayed);
                }
                if (stats.lastPlayed && typeof stats.lastPlayed === 'string') {
                    stats.lastPlayed = new Date(stats.lastPlayed);
                }
                stats.completions = stats.completions.map(c => ({
                    ...c,
                    timestamp: typeof c.timestamp === 'string' ? new Date(c.timestamp) : c.timestamp
                }));

                this.statsMap.set(id, stats);
                importCount++;
            }

            this.saveStats();
            return importCount;
        } catch (error) {
            console.error('Failed to import stats:', error);
            throw new Error('Invalid stats JSON format');
        }
    }

    /**
     * Get summary statistics across all levels
     */
    public getGlobalSummary(): {
        totalLevelsPlayed: number;
        totalAttempts: number;
        totalCompletions: number;
        averageCompletionRate: number;
        totalPlayTimeSeconds: number;
    } {
        let totalLevelsPlayed = 0;
        let totalAttempts = 0;
        let totalCompletions = 0;
        let totalPlayTimeSeconds = 0;
        let totalCompletionRates = 0;

        for (const stats of this.statsMap.values()) {
            if (stats.totalAttempts > 0) {
                totalLevelsPlayed++;
                totalAttempts += stats.totalAttempts;
                totalCompletions += stats.totalCompletions;
                totalCompletionRates += stats.completionRate;

                // Sum all completion times
                for (const completion of stats.completions) {
                    if (completion.survived) {
                        totalPlayTimeSeconds += completion.completionTimeSeconds;
                    }
                }
            }
        }

        return {
            totalLevelsPlayed,
            totalAttempts,
            totalCompletions,
            averageCompletionRate: totalLevelsPlayed > 0 ? totalCompletionRates / totalLevelsPlayed : 0,
            totalPlayTimeSeconds
        };
    }

    /**
     * Format time in MM:SS format
     */
    public static formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format completion rate as percentage
     */
    public static formatCompletionRate(rate: number): string {
        return `${rate.toFixed(1)}%`;
    }
}
