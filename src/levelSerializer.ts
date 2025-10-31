import { Vector3 } from "@babylonjs/core";
import { DefaultScene } from "./defaultScene";
import {
    LevelConfig,
    ShipConfig,
    StartBaseConfig,
    SunConfig,
    PlanetConfig,
    AsteroidConfig,
    Vector3Array
} from "./levelConfig";
import debugLog from './debug';

/**
 * Serializes the current runtime state of a level to JSON configuration
 */
export class LevelSerializer {
    private scene = DefaultScene.MainScene;

    /**
     * Serialize the current level state to a LevelConfig object
     */
    public serialize(difficulty: string = 'custom'): LevelConfig {
        const ship = this.serializeShip();
        const startBase = this.serializeStartBase();
        const sun = this.serializeSun();
        const planets = this.serializePlanets();
        const asteroids = this.serializeAsteroids();

        return {
            version: "1.0",
            difficulty,
            timestamp: new Date().toISOString(),
            metadata: {
                generator: "LevelSerializer",
                description: `Captured level state at ${new Date().toLocaleString()}`
            },
            ship,
            startBase,
            sun,
            planets,
            asteroids
        };
    }

    /**
     * Serialize ship state
     */
    private serializeShip(): ShipConfig {
        // Find the ship transform node
        const shipNode = this.scene.getTransformNodeByName("ship");

        if (!shipNode) {
            console.warn("Ship not found, using default position");
            return {
                position: [0, 1, 0],
                rotation: [0, 0, 0],
                linearVelocity: [0, 0, 0],
                angularVelocity: [0, 0, 0]
            };
        }

        const position = this.vector3ToArray(shipNode.position);
        const rotation = this.vector3ToArray(shipNode.rotation);

        // Get physics body velocities if available
        let linearVelocity: Vector3Array = [0, 0, 0];
        let angularVelocity: Vector3Array = [0, 0, 0];

        if (shipNode.physicsBody) {
            linearVelocity = this.vector3ToArray(shipNode.physicsBody.getLinearVelocity());
            angularVelocity = this.vector3ToArray(shipNode.physicsBody.getAngularVelocity());
        }

        return {
            position,
            rotation,
            linearVelocity,
            angularVelocity
        };
    }

    /**
     * Serialize start base state
     */
    private serializeStartBase(): StartBaseConfig {
        const startBase = this.scene.getMeshByName("startBase");

        if (!startBase) {
            console.warn("Start base not found, using defaults");
            return {
                position: [0, 0, 0],
                diameter: 10,
                height: 1,
                color: [1, 1, 0]
            };
        }

        const position = this.vector3ToArray(startBase.position);

        // Try to extract diameter and height from scaling or metadata
        // Assuming cylinder was created with specific dimensions
        const diameter = 10; // Default from Level1
        const height = 1;    // Default from Level1

        // Get color from material if available
        let color: Vector3Array = [1, 1, 0]; // Default yellow
        if (startBase.material && (startBase.material as any).diffuseColor) {
            const diffuseColor = (startBase.material as any).diffuseColor;
            color = [diffuseColor.r, diffuseColor.g, diffuseColor.b];
        }

        return {
            position,
            diameter,
            height,
            color
        };
    }

    /**
     * Serialize sun state
     */
    private serializeSun(): SunConfig {
        const sun = this.scene.getMeshByName("sun");

        if (!sun) {
            console.warn("Sun not found, using defaults");
            return {
                position: [0, 0, 400],
                diameter: 50,
                intensity: 1000000
            };
        }

        const position = this.vector3ToArray(sun.position);

        // Get diameter from scaling (assuming uniform scaling)
        const diameter = 50; // Default from createSun

        // Try to find the sun's light for intensity
        let intensity = 1000000;
        const sunLight = this.scene.getLightByName("light");
        if (sunLight) {
            intensity = sunLight.intensity;
        }

        return {
            position,
            diameter,
            intensity
        };
    }

    /**
     * Serialize all planets
     */
    private serializePlanets(): PlanetConfig[] {
        const planets: PlanetConfig[] = [];

        // Find all meshes that start with "planet-"
        const planetMeshes = this.scene.meshes.filter(mesh =>
            mesh.name.startsWith('planet-')
        );

        for (const mesh of planetMeshes) {
            const position = this.vector3ToArray(mesh.position);
            const rotation = this.vector3ToArray(mesh.rotation);

            // Get diameter from bounding info
            const boundingInfo = mesh.getBoundingInfo();
            const diameter = boundingInfo.boundingSphere.radiusWorld * 2;

            // Get texture path from material
            let texturePath = "/planetTextures/Arid/Arid_01-512x512.png"; // Default
            if (mesh.material && (mesh.material as any).diffuseTexture) {
                const texture = (mesh.material as any).diffuseTexture;
                texturePath = texture.url || texturePath;
            }

            planets.push({
                name: mesh.name,
                position,
                diameter,
                texturePath,
                rotation
            });
        }

        return planets;
    }

    /**
     * Serialize all asteroids
     */
    private serializeAsteroids(): AsteroidConfig[] {
        const asteroids: AsteroidConfig[] = [];

        // Find all meshes that start with "asteroid-"
        const asteroidMeshes = this.scene.meshes.filter(mesh =>
            mesh.name.startsWith('asteroid-') && mesh.metadata?.type === 'asteroid'
        );

        for (const mesh of asteroidMeshes) {
            const position = this.vector3ToArray(mesh.position);
            const scaling = this.vector3ToArray(mesh.scaling);

            // Get velocities from physics body
            let linearVelocity: Vector3Array = [0, 0, 0];
            let angularVelocity: Vector3Array = [0, 0, 0];
            let mass = 10000; // Default

            if (mesh.physicsBody) {
                linearVelocity = this.vector3ToArray(mesh.physicsBody.getLinearVelocity());
                angularVelocity = this.vector3ToArray(mesh.physicsBody.getAngularVelocity());
                mass = mesh.physicsBody.getMassProperties().mass;
            }

            asteroids.push({
                id: mesh.name,
                position,
                scaling,
                linearVelocity,
                angularVelocity,
                mass
            });
        }

        return asteroids;
    }

    /**
     * Helper to convert Vector3 to array
     */
    private vector3ToArray(vector: Vector3): Vector3Array {
        return [
            parseFloat(vector.x.toFixed(3)),
            parseFloat(vector.y.toFixed(3)),
            parseFloat(vector.z.toFixed(3))
        ];
    }

    /**
     * Export current level to JSON string
     */
    public serializeToJSON(difficulty: string = 'custom'): string {
        const config = this.serialize(difficulty);
        return JSON.stringify(config, null, 2);
    }

    /**
     * Download current level as JSON file
     */
    public downloadJSON(difficulty: string = 'custom', filename?: string): void {
        const json = this.serializeToJSON(difficulty);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `level-captured-${difficulty}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        debugLog(`Downloaded level state: ${a.download}`);
    }

    /**
     * Static helper to serialize and download current level
     */
    public static export(difficulty: string = 'custom', filename?: string): void {
        const serializer = new LevelSerializer();
        serializer.downloadJSON(difficulty, filename);
    }
}
