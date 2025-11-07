/**
 * Global game configuration settings
 * Singleton class for managing game-wide settings
 */
export class GameConfig {
    private static _instance: GameConfig;

    public debug: boolean = false;
    // Physics settings
    public physicsEnabled: boolean = true;

    /**
     * Private constructor for singleton pattern
     */
    private constructor() {
        // Load settings from localStorage if available
        this.loadFromStorage();
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): GameConfig {
        if (!GameConfig._instance) {
            GameConfig._instance = new GameConfig();
        }
        return GameConfig._instance;
    }

    /**
     * Save current configuration to localStorage
     */
    public save(): void {
        const config = {
            physicsEnabled: this.physicsEnabled,
            debug: this.debug
        };
        localStorage.setItem('game-config', JSON.stringify(config));
    }

    /**
     * Load configuration from localStorage
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem('game-config');
            if (stored) {
                const config = JSON.parse(stored);
                this.physicsEnabled = config.physicsEnabled ?? true;
                this.debug = config.debug ?? false;
            } else {
                this.save();
            }
        } catch (error) {
            console.warn('Failed to load game config from localStorage:', error);
        }
    }

    /**
     * Reset to default settings
     */
    public reset(): void {
        this.physicsEnabled = true;
        this.debug = false;
        this.save();
    }
}
