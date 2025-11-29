/**
 * Level configuration schema for serializing and deserializing game levels
 */

/**
 * 3D vector stored as array [x, y, z]
 */
export type Vector3Array = [number, number, number];

/**
 * 4D quaternion stored as array [x, y, z, w]
 */
type QuaternionArray = [number, number, number, number];

/**
 * 4D color stored as array [r, g, b, a] (0-1 range)
 */
type Color4Array = [number, number, number, number];

/**
 * Material configuration for PBR materials
 */
interface MaterialConfig {
    id: string;
    name: string;
    type: "PBR" | "Standard" | "Basic";
    albedoColor?: Vector3Array; // RGB color (Color3)
    metallic?: number;
    roughness?: number;
    emissiveColor?: Vector3Array;
    emissiveIntensity?: number;
    alpha?: number;
    backFaceCulling?: boolean;
    textures?: {
        albedo?: string; // Asset reference or data URL
        normal?: string;
        metallic?: string;
        roughness?: string;
        emissive?: string;
    };
}

/**
 * Scene hierarchy node (TransformNode or Mesh)
 */
interface SceneNodeConfig {
    id: string;
    name: string;
    type: "TransformNode" | "Mesh" | "InstancedMesh";
    position: Vector3Array;
    rotation?: Vector3Array;
    rotationQuaternion?: QuaternionArray;
    scaling?: Vector3Array;
    parentId?: string; // Reference to parent node
    materialId?: string; // Reference to material
    assetReference?: string; // For meshes loaded from GLB
    isVisible?: boolean;
    isEnabled?: boolean;
    metadata?: any;
}

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
interface StartBaseConfig {
    position?: Vector3Array;  // Defaults to [0, 0, 0] if not specified
    baseGlbPath?: string;     // Path to base GLB model (defaults to 'base.glb')
    landingGlbPath?: string;  // Path to landing zone GLB model (uses same file as base, different mesh name)
}

/**
 * Sun configuration
 */
interface SunConfig {
    position: Vector3Array;
    diameter: number;
    intensity?: number; // Light intensity
}

/**
 * Individual planet configuration
 */
interface PlanetConfig {
    name: string;
    position: Vector3Array;
    diameter: number;
    texturePath: string;
    rotation?: Vector3Array;
}

/**
 * Individual asteroid configuration
 */
interface AsteroidConfig {
    id: string;
    position: Vector3Array;
    scale: number;  // Uniform scale applied to all axes
    linearVelocity: Vector3Array;
    angularVelocity?: Vector3Array;
    mass?: number;
}

/**
 * Difficulty configuration settings
 */
interface DifficultyConfig {
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
        babylonVersion?: string;
        captureTime?: number;
        parTime?: number; // Expected completion time in seconds for scoring
        [key: string]: any;
    };

    ship: ShipConfig;
    startBase?: StartBaseConfig;
    sun: SunConfig;
    planets: PlanetConfig[];
    asteroids: AsteroidConfig[];

    // Optional: include original difficulty config for reference
    difficultyConfig?: DifficultyConfig;

    // Physics configuration
    useOrbitConstraints?: boolean; // Default: true - constrains asteroids to orbit at fixed distance

    // New fields for full scene serialization
    materials?: MaterialConfig[];
    sceneHierarchy?: SceneNodeConfig[];
    assetReferences?: { [key: string]: string }; // mesh id -> asset path (e.g., "ship" -> "ship.glb")
}

/**
 * Validation result
 */
interface ValidationResult {
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
        // HYBRID MIGRATION NOTE: If we need to support legacy localStorage data,
        // add migration here before validation:
        //
        // config.asteroids = config.asteroids.map((a, i) => ({
        //     ...a,
        //     id: a.id || `asteroid-${i}`,                    // Auto-generate missing ids
        //     scale: a.scale || a.scaling?.[0] || a.size || 1 // Migrate from old formats
        // }));
        //
        // This would auto-heal old data with "scaling" array or "size" property

        config.asteroids.forEach((asteroid: any, idx: number) => {
            if (!asteroid.id || typeof asteroid.id !== 'string') {
                errors.push(`Asteroid ${idx}: missing or invalid id`);
            }
            if (!Array.isArray(asteroid.position) || asteroid.position.length !== 3) {
                errors.push(`Asteroid ${idx}: invalid position - must be [x, y, z] array`);
            }
            if (typeof asteroid.scale !== 'number' || asteroid.scale <= 0) {
                errors.push(`Asteroid ${idx}: invalid scale - must be a positive number`);
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
