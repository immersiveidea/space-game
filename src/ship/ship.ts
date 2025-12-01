import {
    Color3,
    FreeCamera,
    HavokPlugin,
    Mesh,
    Observable,
    PhysicsActivationControl,
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
import log from "../core/logger";
import { Scoreboard } from "../ui/hud/scoreboard";
import loadAsset from "../utils/loadAsset";
import { KeyboardInput } from "./input/keyboardInput";
import { ControllerInput } from "./input/controllerInput";
import { ShipPhysics } from "./shipPhysics";
import { ShipAudio } from "./shipAudio";
import { VoiceAudioSystem } from "./voiceAudioSystem";
import { WeaponSystem } from "./weaponSystem";
import { StatusScreen } from "../ui/hud/statusScreen";
import { GameStats } from "../game/gameStats";
import { getAnalytics } from "../analytics";
import { InputControlManager } from "./input/inputControlManager";

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

    // Flag to prevent game end checks until gameplay has started
    private _gameplayStarted: boolean = false;


    // Scene observer references (for cleanup)
    private _physicsObserver: any = null;
    private _renderObserver: any = null;

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

    public get statusScreen(): StatusScreen {
        return this._statusScreen;
    }

    public get keyboardInput(): KeyboardInput {
        return this._keyboardInput;
    }

    public get isInLandingZone(): boolean {
        return this._isInLandingZone;
    }

    /**
     * Start gameplay - enables game end condition checking
     * Call this after level initialization is complete
     */
    public startGameplay(): void {
        this._gameplayStarted = true;
        log.debug('[Ship] Gameplay started - game end conditions now active');
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

    public setLinearVelocity(velocity: Vector3): void {
        if (this._ship?.physicsBody) {
            this._ship.physicsBody.setLinearVelocity(velocity);
        }
    }

    public setAngularVelocity(velocity: Vector3): void {
        if (this._ship?.physicsBody) {
            this._ship.physicsBody.setAngularVelocity(velocity);
        }
    }

    public async initialize() {
        this._scoreboard = new Scoreboard();
        this._scoreboard.setShip(this); // Pass ship reference for velocity reading
        this._gameStats = new GameStats();
        this._ship = new TransformNode("shipBase", DefaultScene.MainScene);
        const data = await loadAsset("ship.glb");
        this._ship = data.container.transformNodes[0];
        //this._ship.rotation = new Vector3(0, Math.PI, 0);
       // this._ship.id = "Ship"; // Set ID so mission brief can find it
        // Position is now set from level config in Level1.initialize()

        // Create physics if enabled
        const config = GameConfig.getInstance();
        if (config.physicsEnabled) {
            log.info("Physics Enabled for Ship");
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
                agg.body.setLinearDamping(config.shipPhysics.linearDamping);
                agg.body.setAngularDamping(config.shipPhysics.angularDamping);
                agg.body.setAngularVelocity(new Vector3(0, 0, 0));
                agg.body.setCollisionCallbackEnabled(true);

                // Debug: Log center of mass before override
                const massProps = agg.body.getMassProperties();
                log.info(`[Ship] Original center of mass (local): ${massProps.centerOfMass.toString()}`);
                log.info(`[Ship] Mass: ${massProps.mass}`);
                log.info(`[Ship] Inertia: ${massProps.inertia.toString()}`);

                // Override center of mass to origin to prevent thrust from causing torque
                // (mesh-based physics was calculating offset center of mass from geometry)
                agg.body.setMassProperties({
                    mass: 10,
                    centerOfMass: new Vector3(0, 0, 0),
                    inertia: massProps.inertia,
                    inertiaOrientation: massProps.inertiaOrientation
                });

                log.info(`[Ship] Center of mass overridden to: ${agg.body.getMassProperties().centerOfMass.toString()}`);

                // Configure physics sleep behavior from config
                // (disabling sleep prevents abrupt stops at zero linear velocity)
                if (config.shipPhysics.alwaysActive) {
                    const physicsPlugin = DefaultScene.MainScene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin;
                    if (physicsPlugin) {
                        physicsPlugin.setActivationControl(agg.body, PhysicsActivationControl.ALWAYS_ACTIVE);
                    }
                }

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
                            log.debug(`Collision damage: ${damage.toFixed(4)} (energy: ${kineticEnergy.toFixed(1)}, speed: ${relativeSpeed.toFixed(1)} m/s)`);

                            // Play collision sound
                            if (this._audio) {
                                this._audio.playCollisionSound();
                            }
                        }
                    }
                });
            } else {
                log.warn("No geometry mesh found, cannot create physics");
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
        this._weapons.setScoreObservable(this._scoreboard.onScoreObservable);
        if (this._ship.physicsBody) {
            this._weapons.setShipBody(this._ship.physicsBody);
        }

        // Initialize input systems (skip in replay mode)
        if (!this._isReplayMode) {
            this._keyboardInput = new KeyboardInput(DefaultScene.MainScene);
            this._keyboardInput.setup();

            this._controllerInput = new ControllerInput();

            // Register input systems with InputControlManager
            const inputManager = InputControlManager.getInstance();
            inputManager.registerInputSystems(this._keyboardInput, this._controllerInput);

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
                        // Hide status screen - InputControlManager will handle control re-enabling
                        this._statusScreen.hide();
                    } else {
                        // Show status screen (manual pause, not game end)
                        // InputControlManager will handle control disabling
                        this._statusScreen.show(false);
                    }
                }
            });

            // Wire up inspector toggle event (Y button)
            this._controllerInput.onInspectorToggleObservable.add(() => {
                import('@babylonjs/inspector').then(() => {
                    const scene = DefaultScene.MainScene;
                    if (scene.debugLayer.isVisible()) {
                        scene.debugLayer.hide();
                    } else {
                        scene.debugLayer.show({ overlay: true, showExplorer: true });
                    }
                });
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
        let p = 0;
        this._physicsObserver = DefaultScene.MainScene.onAfterPhysicsObservable.add(() => {

                this.updatePhysics();

        });
        let renderFrameCount = 0;
        this._renderObserver = DefaultScene.MainScene.onAfterRenderObservable.add(() => {
            // Update voice audio system (checks for completed sounds and plays next in queue)
            if (this._voiceAudio) {
                this._voiceAudio.update();
            }
            // Update projectiles (shape casting collision detection)
            if (this._weapons) {
                const deltaTime = DefaultScene.MainScene.getEngine().getDeltaTime() / 1000;
                this._weapons.update(deltaTime);
            }
            // Check game end conditions every 30 frames (~0.5 sec at 60fps)
            if (renderFrameCount++ % 30 === 0) {
                this.checkGameEndConditions();
            }
        });

        // Setup camera
        this._camera = new FreeCamera(
            "Flat Camera",
            new Vector3(0, 1.5, 0),
            DefaultScene.MainScene
        );
        this._camera.parent = this._ship;
        // Rotate camera 180 degrees around Y to compensate for inverted ship GLB model
        this._camera.rotation = new Vector3(0, Math.PI, 0);

        // Set as active camera if XR is not available
        if (!DefaultScene.XR && !this._isReplayMode) {
            DefaultScene.MainScene.activeCamera = this._camera;
            //this._camera.attachControl(DefaultScene.MainScene.getEngine().getRenderingCanvas(), true);
            log.debug('Flat camera set as active camera');
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
                log.debug('Analytics tracking failed:', error);
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
                    log.debug('Analytics tracking failed:', error);
                }
            }
        });

        // Initialize status screen with callbacks
        this._statusScreen = new StatusScreen(
            DefaultScene.MainScene,
            this._ship,
            this._gameStats,
            () => this.handleReplayRequest(),
            () => this.handleExitVR(),
            () => this.handleResume(),
            () => this.handleNextLevel()
        );
        this._statusScreen.initialize();
    }

    /**
     * Handle replay button click from status screen
     */
    private handleReplayRequest(): void {
        log.debug('Replay button clicked - notifying observers');
        this.onReplayRequestObservable.notifyObservers();
    }

    /**
     * Handle exit VR button click from status screen
     */
    private async handleExitVR(): Promise<void> {
        log.debug('Exit VR button clicked - navigating to home');

        try {
            // Ensure the app UI is visible before navigating (safety net)
            const appElement = document.getElementById('app');
            if (appElement) {
                appElement.style.display = 'block';
            }
            const headerElement = document.getElementById('appHeader');
            if (headerElement) {
                headerElement.style.display = 'block';
            }


            // Navigate back to home route
            // The PlayLevel component's onDestroy will handle cleanup
            const { navigate } = await import('svelte-routing');
            navigate('/', { replace: true });
        } catch (error) {
            log.error('Failed to navigate, falling back to reload:', error);
            window.location.reload();
        }
    }

    /**
     * Handle resume button click from status screen
     */
    private handleResume(): void {
        log.debug('Resume button clicked - hiding status screen');
        // InputControlManager will handle re-enabling controls when status screen hides
        this._statusScreen.hide();
    }

    /**
     * Handle next level button click from status screen
     */
    private handleNextLevel(): void {
        log.debug('Next Level button clicked - navigating to level selector');
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
        // Skip if gameplay hasn't started yet (prevents false triggers during initialization)
        if (!this._gameplayStarted) {
            return;
        }

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
            log.debug('Game end condition met: Hull critical outside landing zone');
            this._statusScreen.show(true, false, 'death'); // Game ended, not victory, death reason
            // InputControlManager will handle disabling controls when status screen shows
            this._statusScreenAutoShown = true;
            return;
        }

        // Check condition 2: Stranded (outside landing zone, no fuel, low velocity)
        if (!this._isInLandingZone && fuel < 0.01 && totalVelocity < 5) {
            log.debug('Game end condition met: Stranded (no fuel, low velocity)');
            this._statusScreen.show(true, false, 'stranded'); // Game ended, not victory, stranded reason
            // InputControlManager will handle disabling controls when status screen shows
            this._statusScreenAutoShown = true;
            return;
        }

        // Check condition 3: Victory (all asteroids destroyed, inside landing zone)
        // Must have had asteroids to destroy in the first place (prevents false victory on init)
        if (asteroidsRemaining <= 0 && this._isInLandingZone && this._scoreboard.hasAsteroidsToDestroy  && this._ship.physicsBody.getLinearVelocity().length() < 5) {
            log.debug('Game end condition met: Victory (all asteroids destroyed)');
            this._statusScreen.show(true, true, 'victory'); // Game ended, VICTORY!
            // InputControlManager will handle disabling controls when status screen shows
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

        // Check if we're in VR mode
        const inVRMode = DefaultScene.XR?.baseExperience?.state === 2; // WebXRState.IN_XR = 2

        // Combine input from keyboard and controller
        const keyboardState = this._keyboardInput?.getInputState() || {
            leftStick: Vector2.Zero(),
            rightStick: Vector2.Zero(),
        };
        const controllerState = this._controllerInput?.getInputState() || {
            leftStick: Vector2.Zero(),
            rightStick: Vector2.Zero(),
        };

        // Merge inputs with smooth deadzone scaling (controller takes priority if active, keyboard disabled in VR)
        // Deadzone: 0.1-0.15 range with linear scaling (avoids abrupt cliff effect)
        const leftMagnitude = controllerState.leftStick.length();
        const rightMagnitude = controllerState.rightStick.length();

        // Scale factor: 0% at 0.1, 100% at 0.15, linear interpolation between
        const leftScale = Math.max(0, Math.min(1, (leftMagnitude - 0.1) / 0.05));
        const rightScale = Math.max(0, Math.min(1, (rightMagnitude - 0.1) / 0.05));

        const combinedInput = {
            leftStick:
                leftMagnitude > 0.1
                    ? controllerState.leftStick.scale(leftScale)
                    : (inVRMode ? Vector2.Zero() : keyboardState.leftStick),
            rightStick:
                rightMagnitude > 0.1
                    ? controllerState.rightStick.scale(rightScale)
                    : (inVRMode ? Vector2.Zero() : keyboardState.rightStick),
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
            log.debug("Ship entered landing zone - resupply active");
        } else if (!this._isInLandingZone && wasInZone) {
            log.debug("Ship exited landing zone - resupply inactive");
        }

        // Resupply at 0.1 per second if in zone
        if (this._isInLandingZone && this._scoreboard?.shipStatus) {
            // Physics update runs every 10 frames at 60fps = 6 times per second
            // 0.1 per second / 6 updates per second = 0.01666... per update
            const resupplyRate = 1 / 600;

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
        const inputManager = InputControlManager.getInstance();
        if (!inputManager.shipControlsEnabled) {
            log.debug('[Ship] Controls disabled - firing mission brief trigger observable');
            this._onMissionBriefTriggerObservable.notifyObservers();
            return;
        }

        if (this._audio) {
            this._audio.playWeaponSound();
        }

        if (this._weapons && this._ship && this._ship.physicsBody) {
            // Clone world matrix to ensure consistent calculations
            const worldMatrix = this._ship.getWorldMatrix().clone();

            // Get ship velocities
            const linearVelocity = this._ship.physicsBody.getLinearVelocity().clone();
            const angularVelocity = this._ship.physicsBody.getAngularVelocity();

            // Spawn offset in local space (must match weaponSystem.ts)
            const localSpawnOffset = new Vector3(0, 0.5, 9.4);

            // Transform spawn offset to world space
            const worldSpawnOffset = Vector3.TransformCoordinates(localSpawnOffset, worldMatrix);

            // Calculate tangential velocity at spawn point: ω × r
            //const tangentialVelocity = angularVelocity.cross(worldSpawnOffset);

            // Velocity at spawn point = ship velocity + tangential from rotation
            //const velocityAtSpawn = linearVelocity.add(tangentialVelocity);

            // Get forward direction using world matrix (same method as thrust)
            const localForward = new Vector3(0, 0, 1);
            const worldForward = Vector3.TransformNormal(localForward, worldMatrix);
            log.debug(worldForward);
            // Final projectile velocity: muzzle velocity in forward direction + ship velocity
            const projectileVelocity = worldForward.scale(1000).add(linearVelocity);
            log.debug(`Velocity  - ${projectileVelocity}`);

            this._weapons.fire(worldSpawnOffset, projectileVelocity);
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
                log.debug("Physics trigger fired for landing zone");
            }
        });
    }

    /**
     * Add a VR controller to the input system
     */
    public addController(controller: WebXRInputSource) {
        log.debug(
            "Ship.addController called for:",
            controller.inputSource.handedness
        );
        if (this._controllerInput) {
            this._controllerInput.addController(controller);
        }
    }


    /**
     * Dispose of ship resources
     */
    public dispose(): void {
        // Remove scene observers first to stop update loops
        if (this._physicsObserver) {
            DefaultScene.MainScene?.onAfterPhysicsObservable.remove(this._physicsObserver);
            this._physicsObserver = null;
        }

        if (this._renderObserver) {
            DefaultScene.MainScene?.onAfterRenderObservable.remove(this._renderObserver);
            this._renderObserver = null;
        }

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
