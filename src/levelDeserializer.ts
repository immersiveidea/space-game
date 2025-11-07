import {
    AbstractMesh, Color3,
    MeshBuilder,
    Observable,
    PBRMaterial,
    Texture,
    Vector3
} from "@babylonjs/core";
import { DefaultScene } from "./defaultScene";
import { RockFactory } from "./rockFactory";
import { ScoreEvent } from "./scoreboard";
import {
    LevelConfig,
    ShipConfig,
    Vector3Array,
    validateLevelConfig
} from "./levelConfig";
import { GameConfig } from "./gameConfig";
import { FireProceduralTexture } from "@babylonjs/procedural-textures";
import { createSphereLightmap } from "./sphereLightmap";
import debugLog from './debug';
import StarBase from "./starBase";

/**
 * Deserializes a LevelConfig JSON object and creates all entities in the scene
 */
export class LevelDeserializer {
    private scene = DefaultScene.MainScene;
    private config: LevelConfig;

    constructor(config: LevelConfig) {
        // Validate config first
        const validation = validateLevelConfig(config);
        if (!validation.valid) {
            throw new Error(`Invalid level config: ${validation.errors.join(', ')}`);
        }

        this.config = config;
    }

    /**
     * Create all entities from the configuration
     */
    public async deserialize(scoreObservable: Observable<ScoreEvent>): Promise<{
        startBase: AbstractMesh | null;
        sun: AbstractMesh;
        planets: AbstractMesh[];
        asteroids: AbstractMesh[];
    }> {
        debugLog('Deserializing level:', this.config.difficulty);

        // Create entities
        const startBase = await this.createStartBase();
        const sun = this.createSun();
        const planets = this.createPlanets();
        const asteroids = await this.createAsteroids(scoreObservable);

        /*
        const dir = new Vector3(-1,-2,-1)

        const light = new DirectionalLight("dirLight", dir, DefaultScene.MainScene);
        const light2 = new DirectionalLight("dirLight2", dir.negate(), DefaultScene.MainScene);
        light2.intensity = .5;
        */
        return {
            startBase,
            sun,
            planets,
            asteroids
        };
    }

    /**
     * Create the start base from config
     */
    private async createStartBase(): Promise<AbstractMesh> {
        return   await StarBase.buildStarBase();
    }

    /**
     * Create the sun from config
     */
    private createSun(): AbstractMesh {
        const config = this.config.sun;
        const sun = MeshBuilder.CreateSphere("sun", {
            diameter: config.diameter,
            segments: 32
        }, this.scene);
        sun.position = this.arrayToVector3(config.position);

        // Create PBR sun material with fire texture
        const material = new PBRMaterial("sunMaterial", this.scene);
        material.emissiveTexture = new FireProceduralTexture("fire", 1024, this.scene);
        material.albedoColor = Color3.Black();
        material.emissiveColor = Color3.White();
        material.disableLighting = true;
        //material.emissiveColor.set(0.5, 0.5, 0.1);
        material.unlit = true;
        sun.material = material;

        return sun;
    }

    /**
     * Create planets from config
     */
    private createPlanets(): AbstractMesh[] {
        const planets: AbstractMesh[] = [];
        const sunPosition = this.arrayToVector3(this.config.sun.position);

        for (const planetConfig of this.config.planets) {
            // Use fewer segments for better performance - planets are background objects
            // 16 segments = ~256 vertices vs 32 segments = ~1024 vertices
            const planet = MeshBuilder.CreateSphere(planetConfig.name, {
                diameter: planetConfig.diameter,
                segments: 12  // Reduced from 32 for performance
            }, this.scene);

            const planetPosition = this.arrayToVector3(planetConfig.position);
            planet.position = planetPosition;

            // Calculate direction from planet to sun
            const toSun = sunPosition.subtract(planetPosition).normalize();

            // Create PBR planet material
            const material = new PBRMaterial(planetConfig.name + "-material", this.scene);
            const texture = new Texture(planetConfig.texturePath, this.scene);

            // Create lightmap with bright light pointing toward sun
            const lightmap = createSphereLightmap(
                planetConfig.name + "-lightmap",
                256,
                this.scene,
                toSun,
                1,
                toSun.negate(),
                0.3,
                0.3
            );

            material.albedoTexture = texture;
            material.lightmapTexture = lightmap;
            material.useLightmapAsShadowmap = true;
            material.roughness = 0.8;
            material.metallic = 0;
            material.unlit = true;
            planet.material = material;

            planets.push(planet);
        }

        debugLog(`Created ${planets.length} planets from config`);
        return planets;
    }

    /**
     * Create asteroids from config
     */
    private async createAsteroids(
        scoreObservable: Observable<ScoreEvent>
    ): Promise<AbstractMesh[]> {
        const asteroids: AbstractMesh[] = [];

        for (let i = 0; i < this.config.asteroids.length; i++) {
            const asteroidConfig = this.config.asteroids[i];

            // Use RockFactory to create the asteroid
            const rock = await RockFactory.createRock(
                i,
                this.arrayToVector3(asteroidConfig.position),
                this.arrayToVector3(asteroidConfig.scaling),
                this.arrayToVector3(asteroidConfig.linearVelocity),
                this.arrayToVector3(asteroidConfig.angularVelocity),
                scoreObservable
            );

            // Get the actual mesh from the Rock object
            // The Rock class wraps the mesh, need to access it via position getter
            const mesh = this.scene.getMeshByName(asteroidConfig.id);
            if (mesh) {
                asteroids.push(mesh);
            }
        }

        debugLog(`Created ${asteroids.length} asteroids from config`);
        return asteroids;
    }

    /**
     * Get ship configuration (for external use to position ship)
     */
    public getShipConfig(): ShipConfig {
        return this.config.ship;
    }

    /**
     * Helper to convert array to Vector3
     */
    private arrayToVector3(arr: Vector3Array): Vector3 {
        return new Vector3(arr[0], arr[1], arr[2]);
    }

    /**
     * Static helper to load from JSON string
     */
    public static fromJSON(json: string): LevelDeserializer {
        const config = JSON.parse(json) as LevelConfig;
        return new LevelDeserializer(config);
    }

    /**
     * Static helper to load from JSON file URL
     */
    public static async fromURL(url: string): Promise<LevelDeserializer> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load level config from ${url}: ${response.statusText}`);
        }
        const json = await response.text();
        return LevelDeserializer.fromJSON(json);
    }

    /**
     * Static helper to load from uploaded file
     */
    public static async fromFile(file: File): Promise<LevelDeserializer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = e.target?.result as string;
                    resolve(LevelDeserializer.fromJSON(json));
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
}
