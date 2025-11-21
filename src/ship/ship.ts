import {
    AbstractMesh,
    Color3,
    FreeCamera,
    Mesh,
    Observable,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    TransformNode,
    Vector2,
    Vector3,
    WebXRInputSource,
} from "@babylonjs/core";
import type { AudioEngineV2 } from "@babylonjs/core";
import { DefaultScene } from "../core/defaultScene";
import { GameConfig } from "../core/gameConfig";
import { Sight } from "./sight";
import debugLog from "../core/debug";
import { Scoreboard } from "../ui/hud/scoreboard";
import loadAsset from "../utils/loadAsset";
import { Debug } from "@babylonjs/core/Legacy/legacy";
import { KeyboardInput } from "./input/keyboardInput";
import { ControllerInput } from "./input/controllerInput";
import { ShipPhysics } from "./shipPhysics";
import { ShipAudio } from "./shipAudio";
import { VoiceAudioSystem } from "./voiceAudioSystem";
import { WeaponSystem } from "./weaponSystem";
import { StatusScreen } from "../ui/hud/statusScreen";
import { GameStats } from "../game/gameStats";
import { getAnalytics } from "../analytics";

export class Ship {
    private _ship: TransformNode;
    private _scoreboard: Scoreboard;
    private _camera: FreeCamera;
    private _audioEngine: AudioEngineV2;
    private _sight: Sight;

    // New modular systems
    private _keyboardInput: KeyboardInput;
    private _controllerInput: ControllerInput;
    private _physics: ShipPhysics;
    private _audio: ShipAudio;
    private _voiceAudio: VoiceAudioSystem;
    private _weapons: WeaponSystem;
    private _statusScreen: StatusScreen;
    private _gameStats: GameStats;

    // Frame counter for physics updates
    private _frameCount: number = 0;

    // Resupply system
    private _landingAggregate: PhysicsAggregate | null = null;
    private _resupplyTimer: number = 0;
    private _isInLandingZone: boolean = false;
    private _isReplayMode: boolean;

    // Observable for replay requests
    public onReplayRequestObservable: Observable<void> = new Observable<void>();

    // Observable for mission brief trigger dismissal
    private _onMissionBriefTriggerObservable: Observable<void> = new Observable<void>();

    // Auto-show status screen flag
    private _statusScreenAutoShown: boolean = false;

    // Controls enabled state
    private _controlsEnabled: boolean = true;

    constructor(audioEngine?: AudioEngineV2, isReplayMode: boolean = false) {
        this._audioEngine = audioEngine;
        this._isReplayMode = isReplayMode;
    }

    public get scoreboard(): Scoreboard {
        return this._scoreboard;
    }

    public get gameStats(): GameStats {
        return this._gameStats;
    }

    public get keyboardInput(): KeyboardInput {
        return this._keyboardInput;
    }

    public get isInLandingZone(): boolean {
        return this._isInLandingZone;
    }

    public get onMissionBriefTriggerObservable(): Observable<void> {
        return this._onMissionBriefTriggerObservable;
    }

    public get velocity(): Vector3 {
        if (this._ship?.physicsBody) {
            return this._ship.physicsBody.getLinearVelocity();
        }
        return Vector3.Zero();
    }

    public set position(newPosition: Vector3) {
        const body = this._ship.physicsBody;

        // Physics body might not exist yet if called before initialize() completes
        if (!body) {
            // Just set position directly on transform node
            this._ship.position.copyFrom(newPosition);
            return;
        }

        body.disablePreStep = false;
        body.transformNode.position.copyFrom(newPosition);
        DefaultScene.MainScene.onAfterRenderObservable.addOnce(() => {
            body.disablePreStep = true;
        });
    }

    public async initialize() {
        this._scoreboard = new Scoreboard();
        this._scoreboard.setShip(this); // Pass ship reference for velocity reading
        this._gameStats = new GameStats();
        this._ship = new TransformNode("shipBase", DefaultScene.MainScene);
        const data = await loadAsset("ship.glb");
        this._ship = data.container.transformNodes[0];
        this._ship.position.y = 5;

        // Create physics if enabled
        const config = GameConfig.getInstance();
        if (config.physicsEnabled) {
            console.log("Physics Enabled for Ship");
            if (this._ship) {
                const agg = new PhysicsAggregate(
                    this._ship,
                    PhysicsShapeType.MESH,
                    {
                        mass: 10,
                        mesh: data.container.rootNodes[0].getChildMeshes()[0] as Mesh,
                    },
                    DefaultScene.MainScene
                );

                agg.body.setMotionType(PhysicsMotionType.DYNAMIC);
                agg.body.setLinearDamping(0.2);
                agg.body.setAngularDamping(0.4);
                agg.body.setAngularVelocity(new Vector3(0, 0, 0));
                agg.body.setCollisionCallbackEnabled(true);

                // Register collision handler for energy-based hull damage
                const observable = agg.body.getCollisionObservable();
                observable.add((collisionEvent) => {
                    // Only calculate damage on collision start to avoid double-counting
                    if (collisionEvent.type === 'COLLISION_STARTED') {
                        // Get collision bodies
                        const shipBody = collisionEvent.collider;
                        const otherBody = collisionEvent.collidedAgainst;

                        // Get velocities
                        const shipVelocity = shipBody.getLinearVelocity();
                        const otherVelocity = otherBody.getLinearVelocity();

                        // Calculate relative velocity
                        const relativeVelocity = shipVelocity.subtract(otherVelocity);
                        const relativeSpeed = relativeVelocity.length();

                        // Get masses
                        const shipMass = 10; // Known ship mass from aggregate creation
                        const otherMass = otherBody.getMassProperties().mass;

                        // Calculate reduced mass for collision
                        const reducedMass = (shipMass * otherMass) / (shipMass + otherMass);

                        // Calculate kinetic energy of collision
                        const kineticEnergy = 0.5 * reducedMass * relativeSpeed * relativeSpeed;

                        // Convert energy to damage (tuning factor)
                        // 1000 units of energy = 0.01 (1%) damage
                        const ENERGY_TO_DAMAGE_FACTOR = 0.01 / 1000;
                        const damage = Math.min(kineticEnergy * ENERGY_TO_DAMAGE_FACTOR, 0.5); // Cap at 50% per hit

                        // Apply damage if above minimum threshold
                        if (this._scoreboard?.shipStatus && damage > 0.001) {
                            this._scoreboard.shipStatus.damageHull(damage);
                            debugLog(`Collision damage: ${damage.toFixed(4)} (energy: ${kineticEnergy.toFixed(1)}, speed: ${relativeSpeed.toFixed(1)} m/s)`);

                            // Play collision sound
                            if (this._audio) {
                                this._audio.playCollisionSound();
                            }
                        }
                    }
                });
            } else {
                console.warn("No geometry mesh found, cannot create physics");
            }
        }

        // Initialize audio system
        if (this._audioEngine) {
            this._audio = new ShipAudio(this._audioEngine);
            await this._audio.initialize();

            // Initialize voice audio system
            this._voiceAudio = new VoiceAudioSystem();
            await this._voiceAudio.initialize(this._audioEngine);
            // Subscribe voice system to ship status events
            this._voiceAudio.subscribeToEvents(this._scoreboard.shipStatus);
        }

        // Initialize weapon system
        this._weapons = new WeaponSystem(DefaultScene.MainScene);
        this._weapons.initialize();
        this._weapons.setShipStatus(this._scoreboard.shipStatus);
        this._weapons.setGameStats(this._gameStats);

        // Initialize input systems (skip in replay mode)
        if (!this._isReplayMode) {
            this._keyboardInput = new KeyboardInput(DefaultScene.MainScene);
            this._keyboardInput.setup();

            this._controllerInput = new ControllerInput();

            // Wire up shooting events
            this._keyboardInput.onShootObservable.add(() => {
                this.handleShoot();
            });

            this._controllerInput.onShootObservable.add(() => {
                this.handleShoot();
            });

            // Wire up status screen toggle event
            this._controllerInput.onStatusScreenToggleObservable.add(() => {
                if (this._statusScreen) {
                    if (this._statusScreen.isVisible) {
                        // Hide status screen and re-enable controls
                        this._statusScreen.hide();
                        this._keyboardInput?.setEnabled(true);
                        this._controllerInput?.setEnabled(true);
                    } else {
                        // Show status screen (manual pause, not game end) and disable controls
                        this._statusScreen.show(false);
                        this._keyboardInput?.setEnabled(false);
                        this._controllerInput?.setEnabled(false);
                    }
                }
            });

            // Wire up camera adjustment events
            this._keyboardInput.onCameraChangeObservable.add((cameraKey) => {
                if (cameraKey === 1) {
                    this._camera.position.x = 15;
                    this._camera.rotation.y = -Math.PI / 2;
                }
            });

            this._controllerInput.onCameraAdjustObservable.add((adjustment) => {
                if (DefaultScene.XR?.baseExperience?.camera) {
                    const camera = DefaultScene.XR.baseExperience.camera;
                    if (adjustment.direction === "down") {
                        camera.position.y = camera.position.y - 0.1;
                    } else {
                        camera.position.y = camera.position.y + 0.1;
                    }
                }
            });
        }

        // Initialize physics controller
        this._physics = new ShipPhysics();
        this._physics.setShipStatus(this._scoreboard.shipStatus);
        this._physics.setGameStats(this._gameStats);

        // Setup physics update loop (every 10 frames)
        DefaultScene.MainScene.onAfterRenderObservable.add(() => {
            this._frameCount++;
            if (this._frameCount >= 10) {
                this._frameCount = 0;
                this.updatePhysics();
            }

            // Update voice audio system (checks for completed sounds and plays next in queue)
            if (this._voiceAudio) {
                this._voiceAudio.update();
            }

            // Check game end conditions every frame (but only acts once)
            this.checkGameEndConditions();
        });

        // Setup camera
        this._camera = new FreeCamera(
            "Flat Camera",
            new Vector3(0, 1.5, 0),
            DefaultScene.MainScene
        );
        this._camera.parent = this._ship;

        // Set as active camera if XR is not available
        if (!DefaultScene.XR && !this._isReplayMode) {
            DefaultScene.MainScene.activeCamera = this._camera;
            //this._camera.attachControl(DefaultScene.MainScene.getEngine().getRenderingCanvas(), true);
            debugLog('Flat camera set as active camera');
        }

        // Create sight reticle
        this._sight = new Sight(DefaultScene.MainScene, this._ship, {
            position: new Vector3(0, 0.1, 125),
            circleRadius: 2,
            crosshairLength: 1.5,
            lineThickness: 0.1,
            color: Color3.Green(),
            renderingGroupId: 3,
            centerGap: 0.5,
        });

        // Initialize scoreboard (it will retrieve and setup its own screen mesh)
        this._scoreboard.initialize();

        // Subscribe to score events to track asteroids destroyed
        this._scoreboard.onScoreObservable.add(() => {
            // Each score event represents an asteroid destroyed
            this._gameStats.recordAsteroidDestroyed();

            // Track asteroid destruction in analytics
            try {
                const analytics = getAnalytics();
                analytics.track('asteroid_destroyed', {
                    weaponType: 'laser', // TODO: Get actual weapon type from event
                    distance: 0, // TODO: Calculate distance if available
                    asteroidSize: 0, // TODO: Get actual size if available
                    remainingCount: this._scoreboard.remaining
                }, { sampleRate: 0.2 }); // Sample 20% of asteroid events to reduce data
            } catch (error) {
                // Analytics not initialized or failed - don't break gameplay
                debugLog('Analytics tracking failed:', error);
            }
        });

        // Subscribe to ship status changes to track hull damage
        this._scoreboard.shipStatus.onStatusChanged.add((event) => {
            if (event.statusType === "hull" && event.delta < 0) {
                // Hull damage (delta is negative)
                const damageAmount = Math.abs(event.delta);
                this._gameStats.recordHullDamage(damageAmount);

                // Track hull damage in analytics
                try {
                    const analytics = getAnalytics();
                    analytics.track('hull_damage', {
                        damageAmount: damageAmount,
                        remainingHull: this._scoreboard.shipStatus.hull,
                        damagePercent: damageAmount,
                        source: 'asteroid_collision' // Default assumption
                    });
                } catch (error) {
                    debugLog('Analytics tracking failed:', error);
                }
            }
        });

        // Initialize status screen with callbacks
        this._statusScreen = new StatusScreen(
            DefaultScene.MainScene,
            this._gameStats,
            () => this.handleReplayRequest(),
            () => this.handleExitVR(),
            () => this.handleResume(),
            () => this.handleNextLevel()
        );
        this._statusScreen.initialize(this._camera);
    }

    /**
     * Handle replay button click from status screen
     */
    private handleReplayRequest(): void {
        debugLog('Replay button clicked - notifying observers');
        this.onReplayRequestObservable.notifyObservers();
    }

    /**
     * Handle exit VR button click from status screen
     */
    private handleExitVR(): void {
        debugLog('Exit VR button clicked - refreshing browser');
        window.location.reload();
    }

    /**
     * Handle resume button click from status screen
     */
    private handleResume(): void {
        debugLog('Resume button clicked - hiding status screen and re-enabling controls');
        this._statusScreen.hide();
        this._keyboardInput?.setEnabled(true);
        this._controllerInput?.setEnabled(true);
    }

    /**
     * Handle next level button click from status screen
     */
    private handleNextLevel(): void {
        debugLog('Next Level button clicked - navigating to level selector');
        // Navigate back to level selector (root route)
        window.location.hash = '#/';
        window.location.reload();
    }

    /**
     * Check game-ending conditions and auto-show status screen
     * Conditions:
     * 1. Ship outside landing zone AND hull < 0.01 (death)
     * 2. Ship outside landing zone AND fuel < 0.01 AND velocity < 1 (stranded)
     * 3. All asteroids destroyed AND ship inside landing zone (victory)
     */
    private checkGameEndConditions(): void {
        // Skip if already auto-shown or status screen doesn't exist
        if (this._statusScreenAutoShown || !this._statusScreen || !this._scoreboard) {
            return;
        }

        // Skip if no physics body yet
        if (!this._ship?.physicsBody) {
            return;
        }

        // Get current ship status
        const hull = this._scoreboard.shipStatus.hull;
        const fuel = this._scoreboard.shipStatus.fuel;
        const asteroidsRemaining = this._scoreboard.remaining;

        // Calculate total linear velocity
        const linearVelocity = this._ship.physicsBody.getLinearVelocity();
        const totalVelocity = linearVelocity.length();

        // Check condition 1: Death by hull damage (outside landing zone)
        if (!this._isInLandingZone && hull < 0.01) {
            debugLog('Game end condition met: Hull critical outside landing zone');
            this._statusScreen.show(true, false); // Game ended, not victory
            this._keyboardInput?.setEnabled(false);
            this._controllerInput?.setEnabled(false);
            this._statusScreenAutoShown = true;
            return;
        }

        // Check condition 2: Stranded (outside landing zone, no fuel, low velocity)
        if (!this._isInLandingZone && fuel < 0.01 && totalVelocity < 1) {
            debugLog('Game end condition met: Stranded (no fuel, low velocity)');
            this._statusScreen.show(true, false); // Game ended, not victory
            this._keyboardInput?.setEnabled(false);
            this._controllerInput?.setEnabled(false);
            this._statusScreenAutoShown = true;
            return;
        }

        // Check condition 3: Victory (all asteroids destroyed, inside landing zone)
        if (asteroidsRemaining <= 0 && this._isInLandingZone) {
            debugLog('Game end condition met: Victory (all asteroids destroyed)');
            this._statusScreen.show(true, true); // Game ended, VICTORY!
            this._keyboardInput?.setEnabled(false);
            this._controllerInput?.setEnabled(false);
            this._statusScreenAutoShown = true;
            return;
        }
    }

    /**
     * Update physics based on combined input from all input sources
     */
    private updatePhysics(): void {
        if (!this._ship?.physicsBody) {
            return;
        }

        // Combine input from keyboard and controller
        const keyboardState = this._keyboardInput?.getInputState() || {
            leftStick: Vector2.Zero(),
            rightStick: Vector2.Zero(),
        };
        const controllerState = this._controllerInput?.getInputState() || {
            leftStick: Vector2.Zero(),
            rightStick: Vector2.Zero(),
        };

        // Merge inputs (controller takes priority if active)
        const combinedInput = {
            leftStick:
                controllerState.leftStick.length() > 0.1
                    ? controllerState.leftStick
                    : keyboardState.leftStick,
            rightStick:
                controllerState.rightStick.length() > 0.1
                    ? controllerState.rightStick
                    : keyboardState.rightStick,
        };

        // Apply forces and get magnitudes for audio
        const forceMagnitudes = this._physics.applyForces(
            combinedInput,
            this._ship.physicsBody,
            this._ship
        );

        // Update audio based on force magnitudes
        if (this._audio) {
            this._audio.updateThrustAudio(
                forceMagnitudes.linearMagnitude,
                forceMagnitudes.angularMagnitude
            );
        }

        // Handle resupply when in landing zone
        this.updateResupply();
    }

    /**
     * Update resupply system - replenishes resources at 0.1 per second when in landing zone
     */
    private updateResupply(): void {
        if (!this._landingAggregate || !this._ship?.physicsBody) {
            return;
        }

        // Check if ship mesh intersects with landing zone mesh
        const wasInZone = this._isInLandingZone;

        // Get the meshes from the transform nodes
        const shipMesh = this._ship.getChildMeshes()[0];
        const landingMesh = this._landingAggregate.transformNode as Mesh;

        // Use mesh intersection for accurate zone detection
        if (shipMesh && landingMesh) {
            this._isInLandingZone = shipMesh.intersectsMesh(landingMesh, false);
        } else {
            // Fallback: if meshes not available, assume not in zone
            this._isInLandingZone = false;
        }

        // Log zone transitions
        if (this._isInLandingZone && !wasInZone) {
            debugLog("Ship entered landing zone - resupply active");
        } else if (!this._isInLandingZone && wasInZone) {
            debugLog("Ship exited landing zone - resupply inactive");
        }

        // Resupply at 0.1 per second if in zone
        if (this._isInLandingZone && this._scoreboard?.shipStatus) {
            // Physics update runs every 10 frames at 60fps = 6 times per second
            // 0.1 per second / 6 updates per second = 0.01666... per update
            const resupplyRate = 0.1 / 6;

            const status = this._scoreboard.shipStatus;

            // Replenish fuel
            if (status.fuel < 1.0) {
                status.addFuel(resupplyRate);
            }

            // Repair hull
            if (status.hull < 1.0) {
                status.repairHull(resupplyRate);
            }

            // Replenish ammo
            if (status.ammo < 1.0) {
                status.addAmmo(resupplyRate);
            }
        }
    }

    /**
     * Handle shooting from any input source
     */
    private handleShoot(): void {
        // If controls are disabled, fire mission brief trigger observable instead of shooting
        if (!this._controlsEnabled) {
            debugLog('[Ship] Controls disabled - firing mission brief trigger observable');
            this._onMissionBriefTriggerObservable.notifyObservers();
            return;
        }

        if (this._audio) {
            this._audio.playWeaponSound();
        }

        if (this._weapons && this._ship && this._ship.physicsBody) {
            // Calculate projectile velocity: ship forward + ship velocity
            const shipVelocity = this._ship.physicsBody.getLinearVelocity();
            const projectileVelocity = this._ship.forward
                .scale(200000)
                .add(shipVelocity);

            this._weapons.fire(this._ship, projectileVelocity);
        }
    }

    public get transformNode() {
        return this._ship;
    }

    /**
     * Set the landing zone for resupply
     */
    public setLandingZone(landingAggregate: PhysicsAggregate): void {
        this._landingAggregate = landingAggregate;

        // Listen for trigger events for debugging (actual detection uses mesh intersection)
        landingAggregate.body.getCollisionObservable().add((collisionEvent) => {
            // Check if the collision is with our ship
            if (collisionEvent.collider === this._ship.physicsBody) {
                debugLog("Physics trigger fired for landing zone");
            }
        });
    }

    /**
     * Add a VR controller to the input system
     */
    public addController(controller: WebXRInputSource) {
        debugLog(
            "Ship.addController called for:",
            controller.inputSource.handedness
        );
        if (this._controllerInput) {
            this._controllerInput.addController(controller);
        }
    }

    /**
     * Disable ship controls (for mission brief, etc.)
     */
    public disableControls(): void {
        debugLog('[Ship] Disabling controls');
        this._controlsEnabled = false;
        if (this._controllerInput) {
            this._controllerInput.setEnabled(false);
        }
        if (this._keyboardInput) {
            this._keyboardInput.setEnabled(false);
        }
    }

    /**
     * Enable ship controls
     */
    public enableControls(): void {
        debugLog('[Ship] Enabling controls');
        this._controlsEnabled = true;
        if (this._controllerInput) {
            this._controllerInput.setEnabled(true);
        }
        if (this._keyboardInput) {
            this._keyboardInput.setEnabled(true);
        }
    }

    /**
     * Dispose of ship resources
     */
    public dispose(): void {
        if (this._sight) {
            this._sight.dispose();
        }

        if (this._keyboardInput) {
            this._keyboardInput.dispose();
        }

        if (this._controllerInput) {
            this._controllerInput.dispose();
        }

        if (this._audio) {
            this._audio.dispose();
        }

        if (this._weapons) {
            this._weapons.dispose();
        }

        if (this._statusScreen) {
            this._statusScreen.dispose();
        }
    }
}
