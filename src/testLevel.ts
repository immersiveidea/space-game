import { DefaultScene } from "./defaultScene";
import {
    Color3,
    DirectionalLight,
    MeshBuilder,
    Observable,
    StandardMaterial,
    Vector3
} from "@babylonjs/core";
import type { AudioEngineV2 } from "@babylonjs/core";
import Level from "./level";

/**
 * Minimal test level with just a box and a light for debugging
 */
export class TestLevel implements Level {
    private _onReadyObservable: Observable<Level> = new Observable<Level>();
    private _initialized: boolean = false;
    private _audioEngine: AudioEngineV2;
    private _boxCreationInterval: NodeJS.Timeout | null = null;
    private _totalBoxesCreated: number = 0;
    private _boxesPerIteration: number = 1;

    constructor(audioEngine: AudioEngineV2) {
        this._audioEngine = audioEngine;
        console.log('[TestLevel] Constructor called');
        // Don't call initialize here - let Main call it after registering the observable
    }

    getReadyObservable(): Observable<Level> {
        return this._onReadyObservable;
    }

    public async play() {
        console.log('[TestLevel] play() called - entering XR');
        console.log('[TestLevel] XR available:', !!DefaultScene.XR);
        console.log('[TestLevel] XR baseExperience:', !!DefaultScene.XR?.baseExperience);

        try {
            // Enter XR mode
            const xr = await DefaultScene.XR.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
            console.log('[TestLevel] XR mode entered successfully');
            console.log('[TestLevel] XR session:', xr);
            console.log('[TestLevel] Camera position:', DefaultScene.XR.baseExperience.camera.position.toString());
            this.startBoxCreation();
        } catch (error) {
            console.error('[TestLevel] ERROR entering XR:', error);
        }
    }

    public dispose() {
        console.log('[TestLevel] dispose() called');

        // Stop box creation timer
        if (this._boxCreationInterval) {
            clearInterval(this._boxCreationInterval);
            this._boxCreationInterval = null;
            console.log('[TestLevel] Box creation timer stopped');
        }
    }

    /**
     * Create a box at the specified position with the specified color
     */
    private createBox(position: Vector3, color: Color3, name?: string): void {
        const box = MeshBuilder.CreateBox(
            name || `box_${this._totalBoxesCreated}`,
            { size: 0.5 },
            DefaultScene.MainScene
        );
        box.position = position;

        const material = new StandardMaterial(`material_${this._totalBoxesCreated}`, DefaultScene.MainScene);
        material.diffuseColor = color;
        material.specularColor = new Color3(0.5, 0.5, 0.5);
        box.material = material;

        this._totalBoxesCreated++;
    }

    /**
     * Start the box creation timer that doubles the number of boxes each iteration
     */
    private startBoxCreation(): void {
        console.log('[TestLevel] Starting box creation timer...');

        const createBatch = () => {
            const boxesToCreate = Math.min(
                this._boxesPerIteration,
                1000 - this._totalBoxesCreated
            );

            console.log(`[TestLevel] Creating ${boxesToCreate} boxes (total will be: ${this._totalBoxesCreated + boxesToCreate}/1000)`);

            for (let i = 0; i < boxesToCreate; i++) {
                // Random position in a 20x20x20 cube around origin
                const position = new Vector3(
                    Math.random() * 20 - 10,
                    Math.random() * 20,
                    Math.random() * 20 - 10
                );

                // Random color
                const color = new Color3(
                    Math.random(),
                    Math.random(),
                    Math.random()
                );

                this.createBox(position, color);
            }

            console.log(`[TestLevel] Created ${boxesToCreate} boxes. Total: ${this._totalBoxesCreated}/1000`);

            // Log performance metrics
            const fps = DefaultScene.MainScene.getEngine().getFps();

            // Directly compute triangle count from all meshes
            const totalIndices = DefaultScene.MainScene.meshes.reduce((sum, mesh) => {
                if (mesh.isEnabled() && mesh.isVisible) {
                    return sum + mesh.getTotalIndices();
                }
                return sum;
            }, 0);
            const triangleCount = Math.floor(totalIndices / 3);

            console.log(`[TestLevel] Performance Metrics:`, {
                fps: fps.toFixed(2),
                triangleCount: triangleCount,
                totalIndices: totalIndices,
                totalMeshes: DefaultScene.MainScene.meshes.length,
                activeMeshes: DefaultScene.MainScene.meshes.filter(m => m.isEnabled() && m.isVisible).length,
                totalBoxes: this._totalBoxesCreated
            });

            // Check if we've reached 1000 boxes
            if (this._totalBoxesCreated >= 1000) {
                console.log('[TestLevel] Reached 1000 boxes, stopping timer');
                if (this._boxCreationInterval) {
                    clearInterval(this._boxCreationInterval);
                    this._boxCreationInterval = null;
                }
                return;
            }

            // Double the number for next iteration
            this._boxesPerIteration *= 2;
        };

        // Create first batch immediately
        createBatch();

        // Set up interval for subsequent batches
        this._boxCreationInterval = setInterval(createBatch, 5000);
    }

    public async initialize() {
        console.log('[TestLevel] initialize() called');
        console.log('[TestLevel] Scene info:', {
            name: DefaultScene.MainScene.name,
            meshCount: DefaultScene.MainScene.meshes.length,
            lightCount: DefaultScene.MainScene.lights.length
        });

        if (this._initialized) {
            console.log('[TestLevel] Already initialized, skipping');
            return;
        }

        // Create a simple directional light
        const light = new DirectionalLight(
            "testLight",
            new Vector3(-1, -2, 1),
            DefaultScene.MainScene
        );
        light.intensity = 1.0;
        console.log('[TestLevel] Created directional light:', {
            name: light.name,
            direction: light.direction.toString(),
            intensity: light.intensity
        });

        // Create a simple colored box
        const box = MeshBuilder.CreateBox(
            "testBox",
            { size: 2 },
            DefaultScene.MainScene
        );
        box.position = new Vector3(0, 1, 5); // In front of camera

        // Create a simple material
        const material = new StandardMaterial("testMaterial", DefaultScene.MainScene);
        material.diffuseColor = new Color3(1, 0, 0); // Red
        material.specularColor = new Color3(0.5, 0.5, 0.5);
        box.material = material;
        console.log('[TestLevel] Created test box:', {
            name: box.name,
            position: box.position.toString(),
            size: 2,
            color: 'red'
        });

        // Create a ground plane for reference
        const ground = MeshBuilder.CreateGround(
            "testGround",
            { width: 10, height: 10 },
            DefaultScene.MainScene
        );
        ground.position.y = 0;

        const groundMaterial = new StandardMaterial("groundMaterial", DefaultScene.MainScene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.3, 0.3); // Grey
        ground.material = groundMaterial;
        console.log('[TestLevel] Created ground plane:', {
            name: ground.name,
            dimensions: '10x10',
            position: ground.position.toString()
        });

        console.log('[TestLevel] Final scene state:', {
            totalMeshes: DefaultScene.MainScene.meshes.length,
            totalLights: DefaultScene.MainScene.lights.length,
            meshNames: DefaultScene.MainScene.meshes.map(m => m.name)
        });

        this._initialized = true;
        console.log('[TestLevel] Initialization complete - scene ready for XR');

        // Notify that initialization is complete
        this._onReadyObservable.notifyObservers(this);
    }
}
