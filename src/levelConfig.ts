/**
 * Level configuration schema for serializing and deserializing game levels
 */

/**
 * 3D vector stored as array [x, y, z]
 */
export type Vector3Array = [number, number, number];

/**
 * Ship configuration
 */
export interface ShipConfig {
    position: Vector3Array;
    rotation?: Vector3Array;
    linearVelocity?: Vector3Array;
    angularVelocity?: Vector3Array;
}

/**
 * Start base configuration (yellow cylinder where asteroids are constrained to)
 * All fields optional to allow levels without start bases
 */
export interface StartBaseConfig {
    position?: Vector3Array;
    diameter?: number;
    height?: number;
    color?: Vector3Array; // RGB values 0-1
}

/**
 * Sun configuration
 */
export interface SunConfig {
    position: Vector3Array;
    diameter: number;
    intensity?: number; // Light intensity
}

/**
 * Individual planet configuration
 */
export interface PlanetConfig {
    name: string;
    position: Vector3Array;
    diameter: number;
    texturePath: string;
    rotation?: Vector3Array;
}

/**
 * Individual asteroid configuration
 */
export interface AsteroidConfig {
    id: string;
    position: Vector3Array;
    scaling: Vector3Array;
    linearVelocity: Vector3Array;
    angularVelocity?: Vector3Array;
    mass?: number;
}

/**
 * Difficulty configuration settings
 */
export interface DifficultyConfig {
    rockCount: number;
    forceMultiplier: number;
    rockSizeMin: number;
    rockSizeMax: number;
    distanceMin: number;
    distanceMax: number;
}

/**
 * Complete level configuration
 */
export interface LevelConfig {
    version: string;
    difficulty: string;
    timestamp?: string; // ISO date string
    metadata?: {
        author?: string;
        description?: string;
        [key: string]: any;
    };

    ship: ShipConfig;
    startBase?: StartBaseConfig;
    sun: SunConfig;
    planets: PlanetConfig[];
    asteroids: AsteroidConfig[];

    // Optional: include original difficulty config for reference
    difficultyConfig?: DifficultyConfig;
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validates a level configuration object
 */
export function validateLevelConfig(config: any): ValidationResult {
    const errors: string[] = [];

    // Check version
    if (!config.version || typeof config.version !== 'string') {
        errors.push('Missing or invalid version field');
    }

    // Check difficulty
    if (!config.difficulty || typeof config.difficulty !== 'string') {
        errors.push('Missing or invalid difficulty field');
    }

    // Check ship
    if (!config.ship) {
        errors.push('Missing ship configuration');
    } else {
        if (!Array.isArray(config.ship.position) || config.ship.position.length !== 3) {
            errors.push('Invalid ship.position - must be [x, y, z] array');
        }
    }

    // Check startBase (optional)
    if (config.startBase) {
        if (config.startBase.position && (!Array.isArray(config.startBase.position) || config.startBase.position.length !== 3)) {
            errors.push('Invalid startBase.position - must be [x, y, z] array');
        }
        if (config.startBase.diameter !== undefined && typeof config.startBase.diameter !== 'number') {
            errors.push('Invalid startBase.diameter - must be a number');
        }
        if (config.startBase.height !== undefined && typeof config.startBase.height !== 'number') {
            errors.push('Invalid startBase.height - must be a number');
        }
    }

    // Check sun
    if (!config.sun) {
        errors.push('Missing sun configuration');
    } else {
        if (!Array.isArray(config.sun.position) || config.sun.position.length !== 3) {
            errors.push('Invalid sun.position - must be [x, y, z] array');
        }
        if (typeof config.sun.diameter !== 'number') {
            errors.push('Invalid sun.diameter - must be a number');
        }
    }

    // Check planets
    if (!Array.isArray(config.planets)) {
        errors.push('Missing or invalid planets array');
    } else {
        config.planets.forEach((planet: any, idx: number) => {
            if (!planet.name || typeof planet.name !== 'string') {
                errors.push(`Planet ${idx}: missing or invalid name`);
            }
            if (!Array.isArray(planet.position) || planet.position.length !== 3) {
                errors.push(`Planet ${idx}: invalid position - must be [x, y, z] array`);
            }
            if (typeof planet.diameter !== 'number') {
                errors.push(`Planet ${idx}: invalid diameter - must be a number`);
            }
            if (!planet.texturePath || typeof planet.texturePath !== 'string') {
                errors.push(`Planet ${idx}: missing or invalid texturePath`);
            }
        });
    }

    // Check asteroids
    if (!Array.isArray(config.asteroids)) {
        errors.push('Missing or invalid asteroids array');
    } else {
        config.asteroids.forEach((asteroid: any, idx: number) => {
            if (!asteroid.id || typeof asteroid.id !== 'string') {
                errors.push(`Asteroid ${idx}: missing or invalid id`);
            }
            if (!Array.isArray(asteroid.position) || asteroid.position.length !== 3) {
                errors.push(`Asteroid ${idx}: invalid position - must be [x, y, z] array`);
            }
            if (!Array.isArray(asteroid.scaling) || asteroid.scaling.length !== 3) {
                errors.push(`Asteroid ${idx}: invalid scaling - must be [x, y, z] array`);
            }
            if (!Array.isArray(asteroid.linearVelocity) || asteroid.linearVelocity.length !== 3) {
                errors.push(`Asteroid ${idx}: invalid linearVelocity - must be [x, y, z] array`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
