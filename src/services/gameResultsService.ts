import { AuthService } from './authService';
import { CloudLeaderboardService } from './cloudLeaderboardService';
import { GameStats } from '../game/gameStats';
import debugLog from '../core/debug';

/**
 * Represents a completed game session result
 */
export interface GameResult {
    id: string;
    timestamp: number;
    playerName: string;
    levelId: string;
    levelName: string;
    completed: boolean;
    endReason: 'victory' | 'death' | 'stranded';

    // Game statistics
    gameTimeSeconds: number;
    asteroidsDestroyed: number;
    totalAsteroids: number;
    accuracy: number;
    hullDamageTaken: number;
    fuelConsumed: number;

    // Scoring
    finalScore: number;
    starRating: number;
}

const STORAGE_KEY = 'space-game-results';

/**
 * Service for storing and retrieving game results
 * Uses localStorage for persistence, designed for future cloud storage expansion
 */
export class GameResultsService {
    private static _instance: GameResultsService;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): GameResultsService {
        if (!GameResultsService._instance) {
            GameResultsService._instance = new GameResultsService();
        }
        return GameResultsService._instance;
    }

    /**
     * Save a game result to storage (local + cloud)
     */
    public saveResult(result: GameResult): void {
        console.log('[GameResultsService] saveResult called with:', result);
        const results = this.getAllResults();
        console.log('[GameResultsService] Existing results count:', results.length);
        results.push(result);
        this.saveToStorage(results);
        console.log('[GameResultsService] Saved result:', result.id, result.finalScore);
        debugLog('[GameResultsService] Saved result:', result.id, result.finalScore);

        // Submit to cloud leaderboard (non-blocking)
        this.submitToCloud(result);
    }

    /**
     * Submit result to cloud leaderboard (async, non-blocking)
     */
    private async submitToCloud(result: GameResult): Promise<void> {
        try {
            const cloudService = CloudLeaderboardService.getInstance();
            if (cloudService.isAvailable()) {
                const success = await cloudService.submitScore(result);
                if (success) {
                    console.log('[GameResultsService] Cloud submission successful');
                } else {
                    console.log('[GameResultsService] Cloud submission skipped (not authenticated or failed)');
                }
            }
        } catch (error) {
            // Don't let cloud failures affect local save
            console.warn('[GameResultsService] Cloud submission error:', error);
        }
    }

    /**
     * Get all stored results
     */
    public getAllResults(): GameResult[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) {
                return [];
            }
            return JSON.parse(data) as GameResult[];
        } catch (error) {
            debugLog('[GameResultsService] Error loading results:', error);
            return [];
        }
    }

    /**
     * Get top results sorted by highest score
     */
    public getTopResults(limit: number = 20): GameResult[] {
        const results = this.getAllResults();
        return results
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, limit);
    }

    /**
     * Clear all stored results (for testing/reset)
     */
    public clearAll(): void {
        localStorage.removeItem(STORAGE_KEY);
        debugLog('[GameResultsService] Cleared all results');
    }

    /**
     * Save results array to localStorage
     */
    private saveToStorage(results: GameResult[]): void {
        try {
            const json = JSON.stringify(results);
            console.log('[GameResultsService] Saving to localStorage, key:', STORAGE_KEY, 'size:', json.length);
            localStorage.setItem(STORAGE_KEY, json);
            console.log('[GameResultsService] Successfully saved to localStorage');
            // Verify it was saved
            const verify = localStorage.getItem(STORAGE_KEY);
            console.log('[GameResultsService] Verification - stored data exists:', !!verify);
        } catch (error) {
            console.error('[GameResultsService] Error saving results:', error);
            debugLog('[GameResultsService] Error saving results:', error);
        }
    }

    /**
     * Build a GameResult from current game state
     * Call this when the game ends (victory, death, or stranded)
     */
    public static buildResult(
        levelId: string,
        levelName: string,
        gameStats: GameStats,
        totalAsteroids: number,
        endReason: 'victory' | 'death' | 'stranded',
        parTime: number
    ): GameResult {
        // Get player name from auth service
        const authService = AuthService.getInstance();
        const user = authService.getUser();
        const playerName = user?.name || user?.email || '<Anonymous>';

        // Get stats
        const stats = gameStats.getStats();
        const scoreCalc = gameStats.calculateFinalScore(parTime);

        return {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            playerName,
            levelId,
            levelName,
            completed: endReason === 'victory',
            endReason,
            gameTimeSeconds: gameStats.getGameTime(),
            asteroidsDestroyed: stats.asteroidsDestroyed,
            totalAsteroids,
            accuracy: stats.accuracy,
            hullDamageTaken: stats.hullDamageTaken,
            fuelConsumed: stats.fuelConsumed,
            finalScore: scoreCalc.finalScore,
            starRating: scoreCalc.stars.total
        };
    }
}
