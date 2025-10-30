/**
 * Texture detail levels for game objects
 */
export enum TextureLevel {
    WIREFRAME = 'WIREFRAME',
    SIMPLE_MATERIAL = 'SIMPLE_MATERIAL',
    FULL_TEXTURE = 'FULL_TEXTURE',
    PBR_TEXTURE = 'PBR_TEXTURE'
}

/**
 * Global game configuration settings
 * Singleton class for managing game-wide settings
 */
export class GameConfig {
    private static _instance: GameConfig;

    // Texture detail settings
    public planetTextureLevel: TextureLevel = TextureLevel.FULL_TEXTURE;
    public asteroidTextureLevel: TextureLevel = TextureLevel.FULL_TEXTURE;
    public sunTextureLevel: TextureLevel = TextureLevel.FULL_TEXTURE;

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
            planetTextureLevel: this.planetTextureLevel,
            asteroidTextureLevel: this.asteroidTextureLevel,
            sunTextureLevel: this.sunTextureLevel,
            physicsEnabled: this.physicsEnabled
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
                this.planetTextureLevel = config.planetTextureLevel ?? TextureLevel.FULL_TEXTURE;
                this.asteroidTextureLevel = config.asteroidTextureLevel ?? TextureLevel.FULL_TEXTURE;
                this.sunTextureLevel = config.sunTextureLevel ?? TextureLevel.FULL_TEXTURE;
                this.physicsEnabled = config.physicsEnabled ?? true;
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
        this.planetTextureLevel = TextureLevel.FULL_TEXTURE;
        this.asteroidTextureLevel = TextureLevel.FULL_TEXTURE;
        this.sunTextureLevel = TextureLevel.FULL_TEXTURE;
        this.physicsEnabled = true;
        this.save();
    }
}
