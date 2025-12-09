/**
 * LevelConfig types - mirror of the game's level config schema
 */
export type Vector3Array = [number, number, number];

export interface ShipConfig {
    position: Vector3Array;
    rotation?: Vector3Array;
    linearVelocity?: Vector3Array;
    angularVelocity?: Vector3Array;
}

export interface SunConfig {
    position: Vector3Array;
    rotation?: Vector3Array;
    diameter: number;
    intensity?: number;
    scale?: Vector3Array;
}

export interface StartBaseConfig {
    position?: Vector3Array;
    rotation?: Vector3Array;
    baseGlbPath?: string;
    landingGlbPath?: string;
}

export interface TargetConfig {
    id: string;
    name: string;
    position: Vector3Array;
}

export interface PlanetConfig {
    name: string;
    position: Vector3Array;
    diameter: number;
    texturePath: string;
    rotation?: Vector3Array;
}

export interface AsteroidConfig {
    id: string;
    position: Vector3Array;
    rotation?: Vector3Array;
    scale: number;
    linearVelocity: Vector3Array;
    angularVelocity?: Vector3Array;
    mass?: number;
    targetId?: string;
    targetMode?: 'orbit' | 'moveToward';
}

export interface LevelConfig {
    version: string;
    difficulty: string;
    timestamp?: string;
    metadata?: {
        author?: string;
        description?: string;
        [key: string]: unknown;
    };
    ship: ShipConfig;
    startBase?: StartBaseConfig;
    sun: SunConfig;
    targets?: TargetConfig[];
    planets: PlanetConfig[];
    asteroids: AsteroidConfig[];
    useOrbitConstraints?: boolean;
}
