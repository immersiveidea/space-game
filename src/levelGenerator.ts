import {
    LevelConfig,
    ShipConfig,
    StartBaseConfig,
    SunConfig,
    PlanetConfig,
    AsteroidConfig,
    DifficultyConfig,
    Vector3Array
} from "./levelConfig";
import { getRandomPlanetTexture } from "./planetTextures";

/**
 * Generates procedural level configurations matching the current Level1 generation logic
 */
export class LevelGenerator {
    private _difficulty: string;
    private _difficultyConfig: DifficultyConfig;

    // Constants matching Level1 defaults
    private static readonly SHIP_POSITION: Vector3Array = [0, 1, 0];
    private static readonly START_BASE_POSITION: Vector3Array = [0, 0, 0];
    private static readonly START_BASE_DIAMETER = 10;
    private static readonly START_BASE_HEIGHT = 1;
    private static readonly START_BASE_COLOR: Vector3Array = [1, 1, 0]; // Yellow

    private static readonly SUN_POSITION: Vector3Array = [0, 0, 400];
    private static readonly SUN_DIAMETER = 50;
    private static readonly SUN_INTENSITY = 1000000;

    // Planet generation constants (matching createPlanetsOrbital call in Level1)
    private static readonly PLANET_COUNT = 12;
    private static readonly PLANET_MIN_DIAMETER = 100;
    private static readonly PLANET_MAX_DIAMETER = 200;
    private static readonly PLANET_MIN_DISTANCE = 1000;
    private static readonly PLANET_MAX_DISTANCE = 2000;

    constructor(difficulty: string) {
        this._difficulty = difficulty;
        this._difficultyConfig = this.getDifficultyConfig(difficulty);
    }

    /**
     * Generate a complete level configuration
     */
    public generate(): LevelConfig {
        const ship = this.generateShip();
        const startBase = this.generateStartBase();
        const sun = this.generateSun();
        const planets = this.generatePlanets();
        const asteroids = this.generateAsteroids();

        return {
            version: "1.0",
            difficulty: this._difficulty,
            timestamp: new Date().toISOString(),
            metadata: {
                generator: "LevelGenerator",
                description: `Procedurally generated ${this._difficulty} level`
            },
            ship,
            startBase,
            sun,
            planets,
            asteroids,
            difficultyConfig: this._difficultyConfig
        };
    }

    private generateShip(): ShipConfig {
        return {
            position: [...LevelGenerator.SHIP_POSITION],
            rotation: [0, 0, 0],
            linearVelocity: [0, 0, 0],
            angularVelocity: [0, 0, 0]
        };
    }

    private generateStartBase(): StartBaseConfig {
        return {
            position: [...LevelGenerator.START_BASE_POSITION],
            diameter: LevelGenerator.START_BASE_DIAMETER,
            height: LevelGenerator.START_BASE_HEIGHT,
            color: [...LevelGenerator.START_BASE_COLOR]
        };
    }

    private generateSun(): SunConfig {
        return {
            position: [...LevelGenerator.SUN_POSITION],
            diameter: LevelGenerator.SUN_DIAMETER,
            intensity: LevelGenerator.SUN_INTENSITY
        };
    }

    /**
     * Generate planets in orbital pattern (matching createPlanetsOrbital logic)
     */
    private generatePlanets(): PlanetConfig[] {
        const planets: PlanetConfig[] = [];
        const sunPosition = LevelGenerator.SUN_POSITION;

        for (let i = 0; i < LevelGenerator.PLANET_COUNT; i++) {
            // Random diameter between min and max
            const diameter = LevelGenerator.PLANET_MIN_DIAMETER +
                Math.random() * (LevelGenerator.PLANET_MAX_DIAMETER - LevelGenerator.PLANET_MIN_DIAMETER);

            // Random distance from sun
            const distance = LevelGenerator.PLANET_MIN_DISTANCE +
                Math.random() * (LevelGenerator.PLANET_MAX_DISTANCE - LevelGenerator.PLANET_MIN_DISTANCE);

            // Random angle around Y axis (orbital plane)
            const angle = Math.random() * Math.PI * 2;

            // Small vertical variation (like a solar system)
            const y = (Math.random() - 0.5) * 100;

            const position: Vector3Array = [
                sunPosition[0] + distance * Math.cos(angle),
                sunPosition[1] + y,
                sunPosition[2] + distance * Math.sin(angle)
            ];

            planets.push({
                name: `planet-${i}`,
                position,
                diameter,
                texturePath: getRandomPlanetTexture(),
                rotation: [0, 0, 0]
            });
        }

        return planets;
    }

    /**
     * Generate asteroids matching Level1.initialize() logic
     */
    private generateAsteroids(): AsteroidConfig[] {
        const asteroids: AsteroidConfig[] = [];
        const config = this._difficultyConfig;

        for (let i = 0; i < config.rockCount; i++) {
            // Random distance from start base
            const distRange = config.distanceMax - config.distanceMin;
            const dist = (Math.random() * distRange) + config.distanceMin;

            // Initial position (forward from start base)
            const position: Vector3Array = [0, 1, dist];

            // Random size
            const sizeRange = config.rockSizeMax - config.rockSizeMin;
            const size = Math.random() * sizeRange + config.rockSizeMin;
            const scaling: Vector3Array = [size, size, size];

            // Calculate initial velocity based on force applied in Level1
            // In Level1: rock.physicsBody.applyForce(new Vector3(50000000 * config.forceMultiplier, 0, 0), rock.position)
            // For a body with mass 10000, force becomes velocity over time
            // Simplified: velocity ≈ force / mass (ignoring physics timestep details)
            const forceMagnitude = 50000000 * config.forceMultiplier;
            const mass = 10000;
            const velocityMagnitude = forceMagnitude / mass / 100; // Approximation

            const linearVelocity: Vector3Array = [velocityMagnitude, 0, 0];

            asteroids.push({
                id: `asteroid-${i}`,
                position,
                scaling,
                linearVelocity,
                angularVelocity: [0, 0, 0],
                mass
            });
        }

        return asteroids;
    }

    /**
     * Get difficulty configuration (matching Level1.getDifficultyConfig)
     */
    private getDifficultyConfig(difficulty: string): DifficultyConfig {
        switch (difficulty) {
            case 'recruit':
                return {
                    rockCount: 5,
                    forceMultiplier: .5,
                    rockSizeMin: 10,
                    rockSizeMax: 15,
                    distanceMin: 80,
                    distanceMax: 100
                };
            case 'pilot':
                return {
                    rockCount: 10,
                    forceMultiplier: 1,
                    rockSizeMin: 8,
                    rockSizeMax: 12,
                    distanceMin: 80,
                    distanceMax: 150
                };
            case 'captain':
                return {
                    rockCount: 20,
                    forceMultiplier: 1.2,
                    rockSizeMin: 2,
                    rockSizeMax: 7,
                    distanceMin: 100,
                    distanceMax: 250
                };
            case 'commander':
                return {
                    rockCount: 50,
                    forceMultiplier: 1.3,
                    rockSizeMin: 2,
                    rockSizeMax: 8,
                    distanceMin: 90,
                    distanceMax: 280
                };
            case 'test':
                return {
                    rockCount: 100,
                    forceMultiplier: 0.3,
                    rockSizeMin: 8,
                    rockSizeMax: 15,
                    distanceMin: 150,
                    distanceMax: 200
                };
            default:
                return {
                    rockCount: 5,
                    forceMultiplier: 1.0,
                    rockSizeMin: 4,
                    rockSizeMax: 8,
                    distanceMin: 170,
                    distanceMax: 220
                };
        }
    }

    /**
     * Static helper to generate and save a level to JSON string
     */
    public static generateJSON(difficulty: string): string {
        const generator = new LevelGenerator(difficulty);
        const config = generator.generate();
        return JSON.stringify(config, null, 2);
    }

    /**
     * Static helper to generate and trigger download of level JSON
     */
    public static downloadJSON(difficulty: string, filename?: string): void {
        const json = LevelGenerator.generateJSON(difficulty);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `level-${difficulty}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
