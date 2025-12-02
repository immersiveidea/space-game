import {
    AbstractMesh,
    Color3,
    MeshBuilder,
    Observable,
    PBRMaterial,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    Texture,
    Vector3,
} from "@babylonjs/core";
import { DefaultScene } from "../../core/defaultScene";
import { RockFactory } from "../../environment/asteroids/rockFactory";
import { ScoreEvent } from "../../ui/hud/scoreboard";
import {
    LevelConfig,
    ShipConfig,
    Vector3Array,
    validateLevelConfig
} from "./levelConfig";
import { FireProceduralTexture } from "@babylonjs/procedural-textures";
import { createSphereLightmap } from "../../environment/celestial/sphereLightmap";
import log from '../../core/logger';
import StarBase from "../../environment/stations/starBase";
import {LevelRegistry} from "../storage/levelRegistry";

/**
 * Deserializes a LevelConfig JSON object and creates all entities in the scene
 */
export class LevelDeserializer {
    private scene = DefaultScene.MainScene;
    private config: LevelConfig;

    constructor(config: LevelConfig) {
        // HYBRID MIGRATION NOTE: If validation fails due to legacy data,
        // consider adding migration logic here before validation:
        //
        // config = migrateLegacyFormat(config);
        //
        // This would allow smooth transition for users with old localStorage data
        // See levelConfig.ts validateLevelConfig() for example migration code

        // Validate config first
        const validation = validateLevelConfig(config);
        if (!validation.valid) {
            throw new Error(`Invalid level config: ${validation.errors.join(', ')}`);
        }

        this.config = config;
    }

    // Store score observable for deferred physics
    private _scoreObservable: Observable<ScoreEvent> | null = null;

    // Store planets for deferred physics
    private _planets: { mesh: AbstractMesh; diameter: number }[] = [];

    /**
     * Deserialize meshes only (Phase 2 - before XR, hidden)
     */
    public async deserializeMeshes(
        scoreObservable: Observable<ScoreEvent>,
        hidden: boolean = false
    ): Promise<{
        startBase: AbstractMesh | null;
        sun: AbstractMesh;
        planets: AbstractMesh[];
        asteroids: AbstractMesh[];
    }> {
        log.debug(`[LevelDeserializer] Deserializing meshes (hidden: ${hidden})`);
        this._scoreObservable = scoreObservable;

        // Create base mesh (no physics)
        const baseResult = await this.createStartBaseMesh(hidden);

        // Create sun and planets (procedural, no physics needed)
        const sun = this.createSun();
        const planets = this.createPlanets();

        // Create asteroid meshes (no physics)
        const asteroids = await this.createAsteroidMeshes(scoreObservable, hidden);

        return {
            startBase: baseResult?.baseMesh || null,
            sun,
            planets,
            asteroids
        };
    }

    /**
     * Initialize physics for all entities (Phase 3 - after XR)
     */
    public initializePhysics(): PhysicsAggregate | null {
        log.debug('[LevelDeserializer] Initializing physics');

        // Initialize base physics
        const landingAggregate = StarBase.initializePhysics();

        // Initialize asteroid physics
        RockFactory.initPhysics();

        // Initialize planet physics (static spheres)
        for (const { mesh, diameter } of this._planets) {
            const agg = new PhysicsAggregate(
                mesh,
                PhysicsShapeType.SPHERE,
                { radius: diameter / 2, mass: 0 },
                this.scene
            );
            agg.body.setMotionType(PhysicsMotionType.STATIC);
        }
        log.debug(`[LevelDeserializer] Created physics for ${this._planets.length} planets`);

        return landingAggregate;
    }

    /**
     * Show all meshes (call after XR entry)
     */
    public showMeshes(): void {
        StarBase.showMeshes();
        RockFactory.showMeshes();
        log.debug('[LevelDeserializer] All meshes shown');
    }

    /**
     * Create base mesh only (no physics)
     */
    private async createStartBaseMesh(hidden: boolean) {
        const position = this.config.startBase?.position;
        const baseGlbPath = this.config.startBase?.baseGlbPath || 'base.glb';
        return await StarBase.addToScene(position, baseGlbPath, hidden);
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
        sun.renderingGroupId = 2;

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
            planet.renderingGroupId = 2;

            planets.push(planet);
            this._planets.push({ mesh: planet, diameter: planetConfig.diameter });
        }

        log.debug(`Created ${planets.length} planets from config`);
        return planets;
    }

    /**
     * Create asteroid meshes only (no physics)
     */
    private async createAsteroidMeshes(
        scoreObservable: Observable<ScoreEvent>,
        hidden: boolean
    ): Promise<AbstractMesh[]> {
        const asteroids: AbstractMesh[] = [];

        for (let i = 0; i < this.config.asteroids.length; i++) {
            const asteroidConfig = this.config.asteroids[i];
            const useOrbitConstraints = this.config.useOrbitConstraints !== false;

            // Create mesh only (no physics)
            RockFactory.createRockMesh(
                i,
                this.arrayToVector3(asteroidConfig.position),
                asteroidConfig.scale,
                this.arrayToVector3(asteroidConfig.linearVelocity),
                this.arrayToVector3(asteroidConfig.angularVelocity),
                scoreObservable,
                useOrbitConstraints,
                hidden
            );

            const mesh = this.scene.getMeshByName(asteroidConfig.id);
            if (mesh) {
                asteroids.push(mesh);
            }
        }

        log.debug(`[LevelDeserializer] Created ${asteroids.length} asteroid meshes (hidden: ${hidden})`);
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

}
