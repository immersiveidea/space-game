/**
 * Default ship physics configuration
 */
const DEFAULT_SHIP_PHYSICS = {
    maxLinearVelocity: 200,
    maxAngularVelocity: 1.4,
    linearForceMultiplier: 500,
    angularForceMultiplier: 1.5,
    linearFuelConsumptionRate: 0.0002778,   // 1 minute at full thrust (60 Hz)
    angularFuelConsumptionRate: 0.0001389,   // 2 minutes at full thrust (60 Hz)
    linearDamping: 0.2,
    angularDamping: 0.5, // Moderate damping for 2-3 second coast
    alwaysActive: true,  // Prevent physics sleep (false may cause abrupt stops at zero velocity)
    reverseThrustFactor: 0.3 // Reverse thrust at 50% of forward thrust power
};

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
    public shipPhysics = { ...DEFAULT_SHIP_PHYSICS };

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
                        maxLinearVelocity: config.shipPhysics.maxLinearVelocity ?? DEFAULT_SHIP_PHYSICS.maxLinearVelocity,
                        maxAngularVelocity: config.shipPhysics.maxAngularVelocity ?? DEFAULT_SHIP_PHYSICS.maxAngularVelocity,
                        linearForceMultiplier: config.shipPhysics.linearForceMultiplier ?? DEFAULT_SHIP_PHYSICS.linearForceMultiplier,
                        angularForceMultiplier: config.shipPhysics.angularForceMultiplier ?? DEFAULT_SHIP_PHYSICS.angularForceMultiplier,
                        linearFuelConsumptionRate: config.shipPhysics.linearFuelConsumptionRate ?? DEFAULT_SHIP_PHYSICS.linearFuelConsumptionRate,
                        angularFuelConsumptionRate: config.shipPhysics.angularFuelConsumptionRate ?? DEFAULT_SHIP_PHYSICS.angularFuelConsumptionRate,
                        linearDamping: config.shipPhysics.linearDamping ?? DEFAULT_SHIP_PHYSICS.linearDamping,
                        angularDamping: config.shipPhysics.angularDamping ?? DEFAULT_SHIP_PHYSICS.angularDamping,
                        alwaysActive: config.shipPhysics.alwaysActive ?? DEFAULT_SHIP_PHYSICS.alwaysActive,
                        reverseThrustFactor: config.shipPhysics.reverseThrustFactor ?? DEFAULT_SHIP_PHYSICS.reverseThrustFactor,
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
        this.shipPhysics = { ...DEFAULT_SHIP_PHYSICS };
        this.save();
    }
}
