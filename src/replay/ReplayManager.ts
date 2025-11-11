import {
    Engine,
    HavokPlugin,
    PhysicsMotionType,
    PhysicsViewer,
    Scene,
    Vector3
} from "@babylonjs/core";
import "@babylonjs/inspector";
import HavokPhysics from "@babylonjs/havok";
import { PhysicsStorage } from "./recording/physicsStorage";
import { ReplayPlayer } from "./ReplayPlayer";
import { CameraMode, ReplayCamera } from "./ReplayCamera";
import { ReplayControls } from "./ReplayControls";
import debugLog from "../core/debug";
import { DefaultScene } from "../core/defaultScene";
import { Level1 } from "../levels/level1";

/**
 * Manages the replay scene, loading recordings, and coordinating replay components
 */
export class ReplayManager {
    private _engine: Engine;
    private _originalScene: Scene;
    private _replayScene: Scene | null = null;
    private _replayHavokPlugin: HavokPlugin | null = null;
    private _physicsViewer: PhysicsViewer | null = null;

    // Replay components
    private _level: Level1 | null = null;
    private _player: ReplayPlayer | null = null;
    private _camera: ReplayCamera | null = null;
    private _controls: ReplayControls | null = null;

    private _onExitCallback: () => void;
    private _keyboardHandler: ((ev: KeyboardEvent) => void) | null = null;

    constructor(engine: Engine, onExit: () => void) {
        this._engine = engine;
        this._originalScene = DefaultScene.MainScene;
        this._onExitCallback = onExit;
    }

    /**
     * Start replay for a specific recording
     */
    public async startReplay(recordingId: string): Promise<void> {
        debugLog(`ReplayManager: Starting replay for ${recordingId}`);

        // Stop any existing render loop immediately
        this._engine.stopRenderLoop();

        try {
            // 1. Load recording from IndexedDB
            const storage = new PhysicsStorage();
            await storage.initialize();
            const recording = await storage.loadRecording(recordingId);
            storage.close();

            if (!recording || !recording.metadata.levelConfig) {
                debugLog("ReplayManager: Recording not found or missing LevelConfig");
                return;
            }

            debugLog(`ReplayManager: Loaded recording with ${recording.snapshots.length} frames`);

            // 2. Create replay scene
            await this.createReplayScene();

            // 3. Use Level1 to populate the scene (reuse game logic!)
            debugLog('ReplayManager: Initializing Level1 in replay mode');
            this._level = new Level1(recording.metadata.levelConfig, null, true); // isReplayMode = true
            await this._level.initialize();
            debugLog('ReplayManager: Level1 initialized successfully');

            // 4. Convert all physics bodies to ANIMATED (replay-controlled)
            let physicsCount = 0;
            for (const mesh of this._replayScene!.meshes) {
                if (mesh.physicsBody) {
                    mesh.physicsBody.setMotionType(PhysicsMotionType.ANIMATED);
                    // Disable collisions for replay objects
                    const shape = mesh.physicsBody.shape;
                    if (shape) {
                        shape.filterMembershipMask = 0;
                        shape.filterCollideMask = 0;
                    }
                    physicsCount++;
                }
            }
            debugLog(`ReplayManager: Set ${physicsCount} objects to ANIMATED motion type`);

            // 5. Create player for physics playback
            this._player = new ReplayPlayer(this._replayScene!, recording);
            await this._player.initialize();

            // Enable physics debug for all replay objects
            if (this._physicsViewer) {
                const replayObjects = this._player.getReplayObjects();
                debugLog(`ReplayManager: Enabling physics debug for ${replayObjects.size} objects`);
                replayObjects.forEach((mesh) => {
                    if (mesh.physicsBody) {
                        this._physicsViewer!.showBody(mesh.physicsBody);
                    }
                });
            }

            // 6. Setup camera
            this._camera = new ReplayCamera(this._replayScene!);

            // Frame all objects initially in FREE mode
            const objects = Array.from(this._player.getReplayObjects().values());
            debugLog(`ReplayManager: Framing ${objects.length} objects for camera`);

            if (objects.length > 0) {
                this._camera.frameAllObjects(objects);
                this._camera.setMode(CameraMode.FREE);
                debugLog(`ReplayManager: Camera set to FREE mode`);
            } else {
                debugLog(`ReplayManager: WARNING - No objects to frame!`);
                // Set default camera position if no objects
                this._camera.getCamera().position.set(0, 50, -100);
                this._camera.getCamera().setTarget(Vector3.Zero());
            }

            // Set ship as follow target for later toggling
            const ship = this._player.getShipMesh();
            if (ship) {
                this._camera.setFollowTarget(ship);
                debugLog(`ReplayManager: Ship set as follow target`);
            }

            // 6. Create controls UI
            this._controls = new ReplayControls(this._player, this._camera, () => {
                this.exitReplay();
            });
            this._controls.initialize();

            // 7. Setup keyboard handler for inspector
            this._keyboardHandler = (ev: KeyboardEvent) => {
                // Toggle inspector with 'i' key
                if (ev.key === 'i' || ev.key === 'I') {
                    if (this._replayScene) {
                        if (this._replayScene.debugLayer.isVisible()) {
                            this._replayScene.debugLayer.hide();
                            debugLog("ReplayManager: Inspector hidden");
                        } else {
                            this._replayScene.debugLayer.show();
                            debugLog("ReplayManager: Inspector shown");
                        }
                    }
                }
            };
            window.addEventListener('keydown', this._keyboardHandler);
            debugLog("ReplayManager: Keyboard handler registered (press 'i' for inspector)");

            // 8. Start render loop
            debugLog(`ReplayManager: Starting render loop for replay scene`);
            debugLog(`ReplayManager: Replay scene has ${this._replayScene!.meshes.length} meshes, camera: ${this._replayScene!.activeCamera?.name}`);

            this._engine.runRenderLoop(() => {
                if (this._replayScene && this._replayScene.activeCamera) {
                    this._replayScene.render();

                    // Update camera and controls
                    if (this._camera) {
                        this._camera.update();
                    }
                    if (this._controls) {
                        this._controls.update();
                    }
                }
            });

            // 9. Auto-start playback
            this._player.play();

            debugLog("ReplayManager: Replay started successfully");
        } catch (error) {
            debugLog("ReplayManager: Error starting replay", error);
            await this.exitReplay();
        }
    }


    /**
     * Create a new scene for replay
     */
    private async createReplayScene(): Promise<void> {
        // Dispose old replay scene if exists
        if (this._replayScene) {
            await this.disposeReplayScene();
        }

        // Create new scene
        this._replayScene = new Scene(this._engine);

        // Create new Havok physics instance for this scene
        debugLog("ReplayManager: Creating Havok physics instance for replay scene");
        const havok = await HavokPhysics();
        this._replayHavokPlugin = new HavokPlugin(true, havok);

        // Enable physics
        this._replayScene.enablePhysics(Vector3.Zero(), this._replayHavokPlugin);

        // Enable physics debug rendering
        this._physicsViewer = new PhysicsViewer(this._replayScene);
        debugLog("ReplayManager: Physics debug viewer created");

        // Update DefaultScene singleton (Level1.initialize will use this scene)
        DefaultScene.MainScene = this._replayScene;

        debugLog("ReplayManager: Replay scene created");
    }

    /**
     * Exit replay and return to original scene
     */
    public async exitReplay(): Promise<void> {
        debugLog("ReplayManager: Exiting replay");

        // Remove keyboard handler
        if (this._keyboardHandler) {
            window.removeEventListener('keydown', this._keyboardHandler);
            this._keyboardHandler = null;
            debugLog("ReplayManager: Keyboard handler removed");
        }

        // Stop render loop
        this._engine.stopRenderLoop();

        // Dispose replay components
        await this.disposeReplayScene();

        // Restore original scene
        DefaultScene.MainScene = this._originalScene;

        // Restore original render loop
        this._engine.runRenderLoop(() => {
            this._originalScene.render();
        });

        // Call exit callback
        this._onExitCallback();

        debugLog("ReplayManager: Exited replay");
    }

    /**
     * Dispose of replay scene and all components
     */
    private async disposeReplayScene(): Promise<void> {
        if (!this._replayScene) {
            return;
        }

        debugLog("ReplayManager: Disposing replay scene");

        // 1. Dispose UI
        if (this._controls) {
            this._controls.dispose();
            this._controls = null;
        }

        // 2. Dispose player (stops playback, removes observables)
        if (this._player) {
            this._player.dispose();
            this._player = null;
        }

        // 3. Dispose camera
        if (this._camera) {
            this._camera.dispose();
            this._camera = null;
        }

        // 4. Dispose level (if exists)
        if (this._level) {
            // Level disposal would happen here if needed
            this._level = null;
        }

        // 6. Dispose all meshes with physics
        this._replayScene.meshes.forEach(mesh => {
            if (mesh.physicsBody) {
                mesh.physicsBody.dispose();
            }
            if (mesh.skeleton) {
                mesh.skeleton.dispose();
            }
            mesh.dispose();
        });

        // 7. Dispose materials and textures
        this._replayScene.materials.forEach(mat => mat.dispose());
        this._replayScene.textures.forEach(tex => tex.dispose());

        // 8. Dispose scene
        this._replayScene.dispose();
        this._replayScene = null;

        // 9. Clean up physics viewer
        if (this._physicsViewer) {
            this._physicsViewer.dispose();
            this._physicsViewer = null;
        }

        // 10. Clean up Havok plugin
        if (this._replayHavokPlugin) {
            this._replayHavokPlugin = null;
        }

        debugLog("ReplayManager: Replay scene disposed");
    }

    /**
     * Get current replay scene
     */
    public getReplayScene(): Scene | null {
        return this._replayScene;
    }
}
