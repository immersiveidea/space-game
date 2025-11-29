import { getAnalytics } from "../analytics";
import log from "../core/logger";
import { calculateScore, ScoreCalculation } from "./scoreCalculator";

/**
 * Tracks game statistics for display on status screen
 */
export class GameStats {
    private _gameStartTime: number = 0;
    private _asteroidsDestroyed: number = 0;
    private _hullDamageTaken: number = 0;
    private _shotsFired: number = 0;
    private _shotsHit: number = 0;
    private _fuelConsumed: number = 0;
    private _performanceTimer: number | null = null;

    /**
     * Start the game timer and performance tracking
     */
    public startTimer(): void {
        this._gameStartTime = Date.now();
        this.startPerformanceTracking();
    }

    /**
     * Start periodic performance snapshots (every 60 seconds)
     */
    private startPerformanceTracking(): void {
        // Clear any existing timer
        if (this._performanceTimer !== null) {
            clearInterval(this._performanceTimer);
        }

        // Send performance snapshot every 60 seconds
        this._performanceTimer = window.setInterval(() => {
            this.sendPerformanceSnapshot();
        }, 60000); // 60 seconds
    }

    /**
     * Stop performance tracking
     */
    private stopPerformanceTracking(): void {
        if (this._performanceTimer !== null) {
            clearInterval(this._performanceTimer);
            this._performanceTimer = null;
        }
    }

    /**
     * Send a performance snapshot to analytics
     */
    private sendPerformanceSnapshot(): void {
        try {
            const analytics = getAnalytics();

            // Get engine performance if available (would need to be passed in)
            // For now, just send gameplay stats as a snapshot
            analytics.trackCustom('gameplay_snapshot', {
                gameTime: this.getGameTime(),
                asteroidsDestroyed: this._asteroidsDestroyed,
                shotsFired: this._shotsFired,
                accuracy: this.getAccuracy(),
                hullDamage: this._hullDamageTaken
            }, { sampleRate: 0.5 }); // 50% sampling for performance snapshots
        } catch (error) {
            log.debug('Performance snapshot failed:', error);
        }
    }

    /**
     * Get elapsed game time in seconds
     */
    public getGameTime(): number {
        if (this._gameStartTime === 0) {
            return 0;
        }
        return Math.floor((Date.now() - this._gameStartTime) / 1000);
    }

    /**
     * Get formatted game time as MM:SS
     */
    public getFormattedGameTime(): string {
        const seconds = this.getGameTime();
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Increment asteroids destroyed count
     */
    public recordAsteroidDestroyed(): void {
        this._asteroidsDestroyed++;
    }

    /**
     * Record hull damage taken
     */
    public recordHullDamage(amount: number): void {
        this._hullDamageTaken += amount;
    }

    /**
     * Record a shot fired
     */
    public recordShotFired(): void {
        this._shotsFired++;
    }

    /**
     * Record a shot that hit a target
     */
    public recordShotHit(): void {
        this._shotsHit++;
    }

    /**
     * Record fuel consumed
     */
    public recordFuelConsumed(amount: number): void {
        this._fuelConsumed += amount;
    }

    /**
     * Get accuracy percentage
     */
    public getAccuracy(): number {
        if (this._shotsFired === 0) {
            return 0;
        }
        return Math.round((this._shotsHit / this._shotsFired) * 100);
    }

    /**
     * Get all statistics
     */
    public getStats() {
        return {
            gameTime: this.getFormattedGameTime(),
            asteroidsDestroyed: this._asteroidsDestroyed,
            hullDamageTaken: Math.round(this._hullDamageTaken * 100),
            shotsFired: this._shotsFired,
            accuracy: this.getAccuracy(),
            fuelConsumed: Math.round(this._fuelConsumed * 100)
        };
    }

    /**
     * Send session end analytics
     */
    public sendSessionEnd(): void {
        try {
            const analytics = getAnalytics();
            analytics.track('session_end', {
                duration: this.getGameTime(),
                totalLevelsPlayed: 1, // TODO: Track across multiple levels
                totalAsteroidsDestroyed: this._asteroidsDestroyed
            }, { immediate: true }); // Send immediately
        } catch (error) {
            log.debug('Session end tracking failed:', error);
        }

        // Stop performance tracking
        this.stopPerformanceTracking();
    }

    /**
     * Reset all statistics
     */
    public reset(): void {
        // Send session end before resetting
        if (this._gameStartTime > 0) {
            this.sendSessionEnd();
        }

        this._gameStartTime = Date.now();
        this._asteroidsDestroyed = 0;
        this._hullDamageTaken = 0;
        this._shotsFired = 0;
        this._shotsHit = 0;
        this._fuelConsumed = 0;

        // Restart performance tracking
        this.startPerformanceTracking();
    }

    /**
     * Calculate final score based on current statistics
     *
     * @param parTime - Expected completion time in seconds (default: 120)
     * @returns Complete score calculation with multipliers and star ratings
     */
    public calculateFinalScore(parTime: number = 120): ScoreCalculation {
        const gameTimeSeconds = this.getGameTime();
        const accuracy = this.getAccuracy();
        const fuelConsumed = this._fuelConsumed * 100; // Convert to percentage
        const hullDamage = this._hullDamageTaken * 100; // Convert to percentage

        return calculateScore(
            gameTimeSeconds,
            accuracy,
            fuelConsumed,
            hullDamage,
            parTime
        );
    }

    /**
     * Cleanup when game ends
     */
    public dispose(): void {
        this.stopPerformanceTracking();
    }
}
