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
    protected _difficulty: string;
    protected _difficultyConfig: DifficultyConfig;

    // Configurable properties (can be overridden by subclasses or set before generate())
    public shipPosition: Vector3Array = [0, 1, 0];

    public sunPosition: Vector3Array = [0, 0, 400];
    public sunDiameter = 50;
    public sunIntensity = 1000000;

    // Planet generation parameters
    public planetCount = 12;
    public planetMinDiameter = 100;
    public planetMaxDiameter = 200;
    public planetMinDistance = 1000;
    public planetMaxDistance = 2000;

    constructor(difficulty: string) {
        this._difficulty = difficulty;
        this._difficultyConfig = this.getDifficultyConfig(difficulty);
    }

    /**
     * Set custom difficulty configuration
     */
    public setDifficultyConfig(config: DifficultyConfig) {
        this._difficultyConfig = config;
    }

    /**
     * Generate a complete level configuration
     */
    public generate(): LevelConfig {
        const ship = this.generateShip();
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
            // startBase is now optional and not generated
            sun,
            planets,
            asteroids,
            difficultyConfig: this._difficultyConfig
        };
    }

    private generateShip(): ShipConfig {
        return {
            position: [...this.shipPosition],
            rotation: [0, 0, 0],
            linearVelocity: [0, 0, 0],
            angularVelocity: [0, 0, 0]
        };
    }

    private generateSun(): SunConfig {
        return {
            position: [...this.sunPosition],
            diameter: this.sunDiameter,
            intensity: this.sunIntensity
        };
    }

    /**
     * Generate planets in orbital pattern (matching createPlanetsOrbital logic)
     */
    private generatePlanets(): PlanetConfig[] {
        const planets: PlanetConfig[] = [];

        for (let i = 0; i < this.planetCount; i++) {
            // Random diameter between min and max
            const diameter = this.planetMinDiameter +
                Math.random() * (this.planetMaxDiameter - this.planetMinDiameter);

            // Random distance from sun
            const distance = this.planetMinDistance +
                Math.random() * (this.planetMaxDistance - this.planetMinDistance);

            // Random angle around Y axis (orbital plane)
            const angle = Math.random() * Math.PI * 2;

            // Small vertical variation (like a solar system)
            const y = (Math.random() - 0.5) * 400;

            const position: Vector3Array = [
                this.sunPosition[0] + distance * Math.cos(angle),
                this.sunPosition[1] + y,
                this.sunPosition[2] + distance * Math.sin(angle)
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
     * Generate asteroids distributed evenly around the base in a spherical pattern (all 3 axes)
     */
    private generateAsteroids(): AsteroidConfig[] {
        const asteroids: AsteroidConfig[] = [];
        const config = this._difficultyConfig;

        for (let i = 0; i < config.rockCount; i++) {
            // Random distance from start base
            const distRange = config.distanceMax - config.distanceMin;
            const dist = (Math.random() * distRange) + config.distanceMin;

            // Evenly distribute asteroids on a sphere using spherical coordinates
            // Azimuth angle (phi): rotation around Y axis
            const phi = (i / config.rockCount) * Math.PI * 2;

            // Elevation angle (theta): angle from top (0) to bottom (π)
            // Using equal area distribution: acos(1 - 2*u) where u is [0,1]
            const u = (i + 0.5) / config.rockCount;
            const theta = Math.acos(1 - 2 * u);

            // Add small random variations to prevent perfect spacing
            const phiVariation = (Math.random() - 0.5) * 0.3; // ±0.15 radians
            const thetaVariation = (Math.random() - 0.5) * 0.3; // ±0.15 radians
            const finalPhi = phi + phiVariation;
            const finalTheta = theta + thetaVariation;

            // Convert spherical to Cartesian coordinates
            const x = dist * Math.sin(finalTheta) * Math.cos(finalPhi);
            const y = dist * Math.cos(finalTheta);
            const z = dist * Math.sin(finalTheta) * Math.sin(finalPhi);

            const position: Vector3Array = [x, y, z];

            // Random size
            const sizeRange = config.rockSizeMax - config.rockSizeMin;
            const size = Math.random() * sizeRange + config.rockSizeMin;
            const scaling: Vector3Array = [size, size, size];

            // Calculate initial velocity based on force applied in Level1
            // Velocity should be tangential to the sphere (perpendicular to radius)
            const forceMagnitude = 50000000 * config.forceMultiplier;
            const mass = 10000;
            const velocityMagnitude = forceMagnitude / mass / 100; // Approximation

            // Tangential velocity: use cross product of radius with an arbitrary vector
            // to get perpendicular direction, then rotate around radius
            // Simple approach: velocity perpendicular to radius in a tangent plane
            const vx = -velocityMagnitude * Math.sin(finalPhi);
            const vy = 0;
            const vz = velocityMagnitude * Math.cos(finalPhi);

            const linearVelocity: Vector3Array = [vx, vy, vz];

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
                    forceMultiplier: .8,
                    rockSizeMin: 10,
                    rockSizeMax: 15,
                    distanceMin: 220,
                    distanceMax: 250
                };
            case 'pilot':
                return {
                    rockCount: 10,
                    forceMultiplier: 1,
                    rockSizeMin: 8,
                    rockSizeMax: 20,
                    distanceMin: 225,
                    distanceMax: 300
                };
            case 'captain':
                return {
                    rockCount: 20,
                    forceMultiplier: 1.2,
                    rockSizeMin: 5,
                    rockSizeMax: 40,
                    distanceMin: 230,
                    distanceMax: 450
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
