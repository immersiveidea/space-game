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

    /**
     * Start the game timer
     */
    public startTimer(): void {
        this._gameStartTime = Date.now();
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
     * Reset all statistics
     */
    public reset(): void {
        this._gameStartTime = Date.now();
        this._asteroidsDestroyed = 0;
        this._hullDamageTaken = 0;
        this._shotsFired = 0;
        this._shotsHit = 0;
        this._fuelConsumed = 0;
    }
}
