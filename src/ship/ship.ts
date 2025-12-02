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

    // Observable for collision events (for hint system)
    private _onCollisionObservable: Observable<{ collisionType: string }> = new Observable<{ collisionType: string }>();

    // Auto-show status screen flag
    private _statusScreenAutoShown: boolean = false;

    // Flag to prevent game end checks until gameplay has started
    private _gameplayStarted: boolean = false;


    // Scene observer references (for cleanup)
    private _physicsObserver: any = null;
    private _renderObserver: any = null;

    // Store loaded asset data for physics initialization
    private _loadedAssetData: any = null;

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

    public get onCollisionObservable(): Observable<{ collisionType: string }> {
        return this._onCollisionObservable;
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

    /**
     * Add ship to scene (Phase 2 - before XR entry)
     * Loads mesh, creates non-physics systems, optionally hidden
     */
    public async addToScene(initialPosition?: Vector3, hidden: boolean = false): Promise<void> {
        log.debug(`[Ship] addToScene called (hidden: ${hidden})`);

        this._scoreboard = new Scoreboard();
        this._scoreboard.setShip(this);
        this._gameStats = new GameStats();

        // Load ship mesh (optionally hidden)
        this._loadedAssetData = await loadAsset("ship.glb", "default", { hidden });
        this._ship = this._loadedAssetData.container.transformNodes[0];

        if (initialPosition) {
            this._ship.position.copyFrom(initialPosition);
        }

        // Initialize input systems (skip in replay mode)
        if (!this._isReplayMode) {
            this._keyboardInput = new KeyboardInput(DefaultScene.MainScene);
            this._keyboardInput.setup();
            this._controllerInput = new ControllerInput();

            const inputManager = InputControlManager.getInstance();
            inputManager.registerInputSystems(this._keyboardInput, this._controllerInput);

            this._keyboardInput.onShootObservable.add(() => this.handleShoot());
            this._controllerInput.onShootObservable.add(() => this.handleShoot());
            this._controllerInput.onStatusScreenToggleObservable.add(() => this.toggleStatusScreen());
            this._controllerInput.onInspectorToggleObservable.add(() => this.toggleInspector());
            this._keyboardInput.onCameraChangeObservable.add((key) => this.handleCameraChange(key));
            this._controllerInput.onCameraAdjustObservable.add((adj) => this.handleCameraAdjust(adj));
        }

        // Setup camera (non-physics)
        this._camera = new FreeCamera("Flat Camera", new Vector3(0, 1.5, 0), DefaultScene.MainScene);
        this._camera.parent = this._ship;
        this._camera.rotation = new Vector3(0, Math.PI, 0);

        if (!DefaultScene.XR && !this._isReplayMode) {
            DefaultScene.MainScene.activeCamera = this._camera;
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

        // Initialize scoreboard and subscribe to events
        this._scoreboard.initialize();
        this.setupScoreboardObservers();

        // Initialize status screen
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

        log.debug('[Ship] addToScene complete');
    }

    /**
     * Initialize physics (Phase 3 - after XR entry)
     * Creates physics body, collision handlers, weapon system
     */
    public initializePhysics(): void {
        log.debug('[Ship] initializePhysics called');
        const config = GameConfig.getInstance();

        if (!config.physicsEnabled || !this._ship || !this._loadedAssetData) {
            log.warn('[Ship] Physics disabled or ship not loaded');
            return;
        }

        const agg = new PhysicsAggregate(
            this._ship,
            PhysicsShapeType.MESH,
            {
                mass: 10,
                mesh: this._loadedAssetData.container.rootNodes[0].getChildMeshes()[0] as Mesh,
            },
            DefaultScene.MainScene
        );

        agg.body.setMotionType(PhysicsMotionType.DYNAMIC);
        agg.body.setLinearDamping(config.shipPhysics.linearDamping);
        agg.body.setAngularDamping(config.shipPhysics.angularDamping);
        agg.body.setAngularVelocity(new Vector3(0, 0, 0));
        agg.body.setCollisionCallbackEnabled(true);

        // Override center of mass to origin
        const massProps = agg.body.getMassProperties();
        agg.body.setMassProperties({
            mass: 10,
            centerOfMass: new Vector3(0, 0, 0),
            inertia: massProps.inertia,
            inertiaOrientation: massProps.inertiaOrientation
        });

        if (config.shipPhysics.alwaysActive) {
            const physicsPlugin = DefaultScene.MainScene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin;
            if (physicsPlugin) {
                physicsPlugin.setActivationControl(agg.body, PhysicsActivationControl.ALWAYS_ACTIVE);
            }
        }

        // Register collision handler
        this.setupCollisionHandler(agg);

        // Initialize weapon system (needs physics)
        this._weapons = new WeaponSystem(DefaultScene.MainScene);
        this._weapons.initialize();
        this._weapons.setShipStatus(this._scoreboard.shipStatus);
        this._weapons.setGameStats(this._gameStats);
        this._weapons.setScoreObservable(this._scoreboard.onScoreObservable);
        this._weapons.setShipBody(this._ship.physicsBody!);

        // Initialize physics controller
        this._physics = new ShipPhysics();
        this._physics.setShipStatus(this._scoreboard.shipStatus);
        this._physics.setGameStats(this._gameStats);

        // Setup update loops
        this._physicsObserver = DefaultScene.MainScene.onAfterPhysicsObservable.add(() => {
            this.updatePhysics();
        });

        let renderFrameCount = 0;
        this._renderObserver = DefaultScene.MainScene.onAfterRenderObservable.add(() => {
            if (this._voiceAudio) this._voiceAudio.update();
            if (this._weapons) {
                const deltaTime = DefaultScene.MainScene.getEngine().getDeltaTime() / 1000;
                this._weapons.update(deltaTime);
            }
            if (renderFrameCount++ % 30 === 0) this.checkGameEndConditions();
        });

        log.debug('[Ship] initializePhysics complete');
    }

    /**
     * Show ship meshes (call after XR entry to make visible)
     */
    public showMeshes(): void {
        if (this._loadedAssetData) {
            for (const mesh of this._loadedAssetData.meshes.values()) {
                mesh.isVisible = true;
                mesh.setEnabled(true);
            }
            log.debug('[Ship] Meshes shown');
        }
    }


    private setupCollisionHandler(agg: PhysicsAggregate): void {
        agg.body.getCollisionObservable().add((collisionEvent) => {
            if (collisionEvent.type !== 'COLLISION_STARTED') return;

            const shipBody = collisionEvent.collider;
            const otherBody = collisionEvent.collidedAgainst;
            const relativeVelocity = shipBody.getLinearVelocity().subtract(otherBody.getLinearVelocity());
            const relativeSpeed = relativeVelocity.length();

            const shipMass = 10;
            const otherMass = otherBody.getMassProperties().mass;
            const reducedMass = (shipMass * otherMass) / (shipMass + otherMass);
            const kineticEnergy = 0.5 * reducedMass * relativeSpeed * relativeSpeed;

            const ENERGY_TO_DAMAGE_FACTOR = 0.01 / 1000;
            const damage = Math.min(kineticEnergy * ENERGY_TO_DAMAGE_FACTOR, 0.5);

            if (this._scoreboard?.shipStatus && damage > 0.001) {
                this._scoreboard.shipStatus.damageHull(damage);
                log.debug(`Collision damage: ${damage.toFixed(4)}`);
                if (this._audio) this._audio.playCollisionSound();
                this._onCollisionObservable.notifyObservers({ collisionType: 'any' });
            }
        });
    }

    private setupScoreboardObservers(): void {
        this._scoreboard.onScoreObservable.add((event) => {
            this._gameStats.recordAsteroidDestroyed(event.scale || 1);
            try {
                const analytics = getAnalytics();
                analytics.track('asteroid_destroyed', {
                    weaponType: 'laser',
                    distance: 0,
                    asteroidSize: event.scale || 0,
                    remainingCount: this._scoreboard.remaining
                }, { sampleRate: 0.2 });
            } catch (error) {
                log.debug('Analytics tracking failed:', error);
            }
        });

        this._scoreboard.shipStatus.onStatusChanged.add((event) => {
            if (event.statusType === "hull" && event.delta < 0) {
                const damageAmount = Math.abs(event.delta);
                this._gameStats.recordHullDamage(damageAmount);
                try {
                    const analytics = getAnalytics();
                    analytics.track('hull_damage', {
                        damageAmount,
                        remainingHull: this._scoreboard.shipStatus.hull,
                        damagePercent: damageAmount / 100,
                        source: 'asteroid_collision'
                    });
                } catch (error) {
                    log.debug('Analytics tracking failed:', error);
                }
            }
        });
    }

    private toggleStatusScreen(): void {
        if (this._statusScreen) {
            if (this._statusScreen.isVisible) {
                this._statusScreen.hide();
            } else {
                this._statusScreen.show(false);
            }
        }
    }

    private toggleInspector(): void {
        import('@babylonjs/inspector').then(() => {
            const scene = DefaultScene.MainScene;
            if (scene.debugLayer.isVisible()) {
                scene.debugLayer.hide();
            } else {
                scene.debugLayer.show({ overlay: true, showExplorer: true });
            }
        });
    }

    private handleCameraChange(cameraKey: number): void {
        if (cameraKey === 1) {
            this._camera.position.x = 15;
            this._camera.rotation.y = -Math.PI / 2;
        }
    }

    private handleCameraAdjust(adjustment: { direction: string }): void {
        if (DefaultScene.XR?.baseExperience?.camera) {
            const camera = DefaultScene.XR.baseExperience.camera;
            camera.position.y += adjustment.direction === "down" ? -0.1 : 0.1;
        }
    }

    /**
     * Initialize audio systems (call after audio engine is unlocked)
     * Separated from initialize() to allow ship creation before XR entry
     */
    public async initializeAudio(audioEngine: AudioEngineV2): Promise<void> {
        if (this._audio) {
            log.debug('[Ship] Audio already initialized, skipping');
            return;
        }

        this._audioEngine = audioEngine;
        log.debug('[Ship] Initializing audio systems');

        this._audio = new ShipAudio(audioEngine);
        await this._audio.initialize();

        this._voiceAudio = new VoiceAudioSystem();
        await this._voiceAudio.initialize(audioEngine);
        this._voiceAudio.subscribeToEvents(this._scoreboard.shipStatus);

        log.debug('[Ship] Audio initialization complete');
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

        // Merge inputs with non-linear curve (controller takes priority if active, keyboard disabled in VR)
        // Deadzone: 0.1, Max input: 0.9, Power curve for slow start, fast finish
        const DEADZONE = 0.1;
        const MAX_INPUT = 0.9;
        const CURVE_EXPONENT = 2.5;

        const leftMagnitude = controllerState.leftStick.length();
        const rightMagnitude = controllerState.rightStick.length();

        // Calculate curved scale: slow at low deflection, ramps up toward max at 0.9
        const leftScale = leftMagnitude <= DEADZONE ? 0 :
            Math.pow(Math.min(1, (leftMagnitude - DEADZONE) / (MAX_INPUT - DEADZONE)), CURVE_EXPONENT);
        const rightScale = rightMagnitude <= DEADZONE ? 0 :
            Math.pow(Math.min(1, (rightMagnitude - DEADZONE) / (MAX_INPUT - DEADZONE)), CURVE_EXPONENT);

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
