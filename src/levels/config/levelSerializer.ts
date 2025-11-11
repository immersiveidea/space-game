import { Vector3, Quaternion, Material, PBRMaterial, StandardMaterial, AbstractMesh, TransformNode } from "@babylonjs/core";
import { DefaultScene } from "../../core/defaultScene";
import {
    LevelConfig,
    ShipConfig,
    StartBaseConfig,
    SunConfig,
    PlanetConfig,
    AsteroidConfig,
    Vector3Array,
    QuaternionArray,
    Color4Array,
    MaterialConfig,
    SceneNodeConfig
} from "./levelConfig";
import debugLog from '../../core/debug';

/**
 * Serializes the current runtime state of a level to JSON configuration
 */
export class LevelSerializer {
    private scene = DefaultScene.MainScene;

    /**
     * Serialize the current level state to a LevelConfig object
     * @param difficulty - Difficulty level string
     * @param includeFullScene - If true, serialize complete scene (materials, hierarchy, assets)
     */
    public serialize(difficulty: string = 'custom', includeFullScene: boolean = true): LevelConfig {
        const ship = this.serializeShip();
        const startBase = this.serializeStartBase();
        const sun = this.serializeSun();
        const planets = this.serializePlanets();
        const asteroids = this.serializeAsteroids();

        const config: LevelConfig = {
            version: "1.0",
            difficulty,
            timestamp: new Date().toISOString(),
            metadata: {
                generator: "LevelSerializer",
                description: `Captured level state at ${new Date().toLocaleString()}`,
                captureTime: performance.now(),
                babylonVersion: "8.32.0"
            },
            ship,
            startBase,
            sun,
            planets,
            asteroids
        };

        // Include full scene serialization if requested
        if (includeFullScene) {
            config.materials = this.serializeMaterials();
            config.sceneHierarchy = this.serializeSceneHierarchy();
            config.assetReferences = this.serializeAssetReferences();

            debugLog(`LevelSerializer: Serialized ${config.materials.length} materials, ${config.sceneHierarchy.length} scene nodes`);
        }

        return config;
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
     * Serialize start base state (position and GLB paths)
     */
    private serializeStartBase(): StartBaseConfig {
        const startBase = this.scene.getMeshByName("startBase");

        if (!startBase) {
            console.warn("Start base not found, using defaults");
            return {
                position: [0, 0, 0],
                baseGlbPath: 'base.glb'
            };
        }

        const position = this.vector3ToArray(startBase.position);

        // Capture GLB path from metadata if available, otherwise use default
        const baseGlbPath = startBase.metadata?.baseGlbPath || 'base.glb';

        return {
            position,
            baseGlbPath
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
            let texturePath = "/assets/materials/planetTextures/Arid/Arid_01-512x512.png"; // Default
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
            // Use uniform scale (assume uniform scaling, take x component)
            const scale = parseFloat(mesh.scaling.x.toFixed(3));

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
                scale,
                linearVelocity,
                angularVelocity,
                mass
            });
        }

        return asteroids;
    }

    /**
     * Serialize all materials in the scene
     */
    private serializeMaterials(): MaterialConfig[] {
        const materials: MaterialConfig[] = [];
        const seenIds = new Set<string>();

        for (const material of this.scene.materials) {
            // Skip duplicates
            if (seenIds.has(material.id)) {
                continue;
            }
            seenIds.add(material.id);

            const materialConfig: MaterialConfig = {
                id: material.id,
                name: material.name,
                type: "Basic",
                alpha: material.alpha,
                backFaceCulling: material.backFaceCulling
            };

            // Handle PBR materials
            if (material instanceof PBRMaterial) {
                materialConfig.type = "PBR";
                if (material.albedoColor) {
                    materialConfig.albedoColor = [
                        material.albedoColor.r,
                        material.albedoColor.g,
                        material.albedoColor.b
                    ];
                }
                materialConfig.metallic = material.metallic;
                materialConfig.roughness = material.roughness;
                if (material.emissiveColor) {
                    materialConfig.emissiveColor = [
                        material.emissiveColor.r,
                        material.emissiveColor.g,
                        material.emissiveColor.b
                    ];
                }
                materialConfig.emissiveIntensity = material.emissiveIntensity;

                // Capture texture references (not data)
                materialConfig.textures = {};
                if (material.albedoTexture) {
                    materialConfig.textures.albedo = material.albedoTexture.name;
                }
                if (material.bumpTexture) {
                    materialConfig.textures.normal = material.bumpTexture.name;
                }
                if (material.metallicTexture) {
                    materialConfig.textures.metallic = material.metallicTexture.name;
                }
                if (material.emissiveTexture) {
                    materialConfig.textures.emissive = material.emissiveTexture.name;
                }
            }
            // Handle Standard materials
            else if (material instanceof StandardMaterial) {
                materialConfig.type = "Standard";
                if (material.diffuseColor) {
                    materialConfig.albedoColor = [
                        material.diffuseColor.r,
                        material.diffuseColor.g,
                        material.diffuseColor.b
                    ];
                }
                if (material.emissiveColor) {
                    materialConfig.emissiveColor = [
                        material.emissiveColor.r,
                        material.emissiveColor.g,
                        material.emissiveColor.b
                    ];
                }
            }

            materials.push(materialConfig);
        }

        return materials;
    }

    /**
     * Serialize scene hierarchy (all transform nodes and meshes)
     */
    private serializeSceneHierarchy(): SceneNodeConfig[] {
        const nodes: SceneNodeConfig[] = [];
        const seenIds = new Set<string>();

        // Serialize all transform nodes
        for (const node of this.scene.transformNodes) {
            if (seenIds.has(node.id)) continue;
            seenIds.add(node.id);

            const nodeConfig: SceneNodeConfig = {
                id: node.id,
                name: node.name,
                type: "TransformNode",
                position: this.vector3ToArray(node.position),
                rotation: this.vector3ToArray(node.rotation),
                scaling: this.vector3ToArray(node.scaling),
                isEnabled: node.isEnabled(),
                metadata: node.metadata
            };

            // Capture quaternion if present
            if (node.rotationQuaternion) {
                nodeConfig.rotationQuaternion = this.quaternionToArray(node.rotationQuaternion);
            }

            // Capture parent reference
            if (node.parent) {
                nodeConfig.parentId = node.parent.id;
            }

            nodes.push(nodeConfig);
        }

        // Serialize all meshes
        for (const mesh of this.scene.meshes) {
            if (seenIds.has(mesh.id)) continue;
            seenIds.add(mesh.id);

            const nodeConfig: SceneNodeConfig = {
                id: mesh.id,
                name: mesh.name,
                type: mesh.getClassName() === "InstancedMesh" ? "InstancedMesh" : "Mesh",
                position: this.vector3ToArray(mesh.position),
                rotation: this.vector3ToArray(mesh.rotation),
                scaling: this.vector3ToArray(mesh.scaling),
                isVisible: mesh.isVisible,
                isEnabled: mesh.isEnabled(),
                metadata: mesh.metadata
            };

            // Capture quaternion if present
            if (mesh.rotationQuaternion) {
                nodeConfig.rotationQuaternion = this.quaternionToArray(mesh.rotationQuaternion);
            }

            // Capture parent reference
            if (mesh.parent) {
                nodeConfig.parentId = mesh.parent.id;
            }

            // Capture material reference
            if (mesh.material) {
                nodeConfig.materialId = mesh.material.id;
            }

            // Determine asset reference from mesh source (use full paths)
            if (mesh.metadata?.source) {
                nodeConfig.assetReference = mesh.metadata.source;
            } else if (mesh.name.includes("ship") || mesh.name.includes("Ship")) {
                nodeConfig.assetReference = "assets/themes/default/models/ship.glb";
            } else if (mesh.name.includes("asteroid") || mesh.name.includes("Asteroid")) {
                nodeConfig.assetReference = "assets/themes/default/models/asteroid.glb";
            } else if (mesh.name.includes("base") || mesh.name.includes("Base")) {
                nodeConfig.assetReference = "assets/themes/default/models/base.glb";
            }

            nodes.push(nodeConfig);
        }

        return nodes;
    }

    /**
     * Serialize asset references (mesh ID -> GLB file path)
     */
    private serializeAssetReferences(): { [key: string]: string } {
        const assetRefs: { [key: string]: string } = {};

        // Map common mesh patterns to their source assets (use full paths as keys)
        for (const mesh of this.scene.meshes) {
            if (mesh.metadata?.source) {
                assetRefs[mesh.id] = mesh.metadata.source;
            } else if (mesh.name.toLowerCase().includes("ship")) {
                assetRefs[mesh.id] = "assets/themes/default/models/ship.glb";
            } else if (mesh.name.toLowerCase().includes("asteroid")) {
                assetRefs[mesh.id] = "assets/themes/default/models/asteroid.glb";
            } else if (mesh.name.toLowerCase().includes("base")) {
                assetRefs[mesh.id] = "assets/themes/default/models/base.glb";
            }
        }

        return assetRefs;
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
     * Helper to convert Quaternion to array
     */
    private quaternionToArray(quat: Quaternion): QuaternionArray {
        return [
            parseFloat(quat.x.toFixed(4)),
            parseFloat(quat.y.toFixed(4)),
            parseFloat(quat.z.toFixed(4)),
            parseFloat(quat.w.toFixed(4))
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
