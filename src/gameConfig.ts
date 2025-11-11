/**
 * Global game configuration settings
 * Singleton class for managing game-wide settings
 */
export class GameConfig {
    private static _instance: GameConfig;

    public debug: boolean = false;
    // Physics settings
    public physicsEnabled: boolean = true;

    // Feature flags
    public progressionEnabled: boolean = true; // Enable level progression system

    // Ship physics tuning parameters
    public shipPhysics = {
        maxLinearVelocity: 200,
        maxAngularVelocity: 1.4,
        linearForceMultiplier: 800,
        angularForceMultiplier: 15
    };

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
            debug: this.debug,
            progressionEnabled: this.progressionEnabled,
            shipPhysics: this.shipPhysics
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
                this.progressionEnabled = config.progressionEnabled ?? true;

                // Load ship physics with fallback to defaults
                if (config.shipPhysics) {
                    this.shipPhysics = {
                        maxLinearVelocity: config.shipPhysics.maxLinearVelocity ?? 200,
                        maxAngularVelocity: config.shipPhysics.maxAngularVelocity ?? 1.4,
                        linearForceMultiplier: config.shipPhysics.linearForceMultiplier ?? 800,
                        angularForceMultiplier: config.shipPhysics.angularForceMultiplier ?? 15
                    };
                }
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
        this.progressionEnabled = true;
        this.shipPhysics = {
            maxLinearVelocity: 200,
            maxAngularVelocity: 1.4,
            linearForceMultiplier: 800,
            angularForceMultiplier: 15
        };
        this.save();
    }
}
