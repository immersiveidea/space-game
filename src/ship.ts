import {
    AbstractMesh,
    Color3,
    FreeCamera,
    Mesh,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    TransformNode,
    Vector2,
    Vector3,
    WebXRInputSource,
} from "@babylonjs/core";
import type { AudioEngineV2 } from "@babylonjs/core";
import { DefaultScene } from "./defaultScene";
import { GameConfig } from "./gameConfig";
import { Sight } from "./sight";
import debugLog from "./debug";
import { Scoreboard } from "./scoreboard";
import loadAsset from "./utils/loadAsset";
import { Debug } from "@babylonjs/core/Legacy/legacy";
import { KeyboardInput } from "./keyboardInput";
import { ControllerInput } from "./controllerInput";
import { ShipPhysics } from "./shipPhysics";
import { ShipAudio } from "./shipAudio";
import { WeaponSystem } from "./weaponSystem";
import { StatusScreen } from "./statusScreen";
import { GameStats } from "./gameStats";

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
    private _weapons: WeaponSystem;
    private _statusScreen: StatusScreen;
    private _gameStats: GameStats;

    // Frame counter for physics updates
    private _frameCount: number = 0;

    // Resupply system
    private _landingAggregate: PhysicsAggregate | null = null;
    private _resupplyTimer: number = 0;
    private _isInLandingZone: boolean = false;

    constructor(audioEngine?: AudioEngineV2) {
        this._audioEngine = audioEngine;
    }

    public get scoreboard(): Scoreboard {
        return this._scoreboard;
    }

    public get gameStats(): GameStats {
        return this._gameStats;
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

                // Register collision handler for hull damage
                const observable = agg.body.getCollisionObservable();
                observable.add((collisionEvent) => {
                    // Damage hull on any collision
                    if (this._scoreboard?.shipStatus) {
                        this._scoreboard.shipStatus.damageHull(0.01);
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
        }

        // Initialize weapon system
        this._weapons = new WeaponSystem(DefaultScene.MainScene);
        this._weapons.initialize();
        this._weapons.setShipStatus(this._scoreboard.shipStatus);

        // Initialize input systems
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
                this._statusScreen.toggle();
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

        // Initialize physics controller
        this._physics = new ShipPhysics();
        this._physics.setShipStatus(this._scoreboard.shipStatus);

        // Setup physics update loop (every 10 frames)
        DefaultScene.MainScene.onAfterRenderObservable.add(() => {
            this._frameCount++;
            if (this._frameCount >= 10) {
                this._frameCount = 0;
                this.updatePhysics();
            }
        });

        // Setup camera
        this._camera = new FreeCamera(
            "Flat Camera",
            new Vector3(0, 0.5, 0),
            DefaultScene.MainScene
        );
        this._camera.parent = this._ship;

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
        this._scoreboard.onScoreObservable.add((scoreEvent) => {
            // Each score event represents an asteroid destroyed
            this._gameStats.recordAsteroidDestroyed();
        });

        // Initialize status screen
        this._statusScreen = new StatusScreen(DefaultScene.MainScene, this._gameStats);
        this._statusScreen.initialize(this._camera);
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

        // Check if ship is still in the landing zone by checking distance
        // Since it's a trigger, we need to track position
        const shipPos = this._ship.physicsBody.transformNode.position;
        const landingPos = this._landingAggregate.transformNode.position;
        const distance = Vector3.Distance(shipPos, landingPos);

        // Assume landing zone radius is approximately 20 units (adjust as needed)
        const wasInZone = this._isInLandingZone;
        this._isInLandingZone = distance < 20;

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

        // Listen for trigger events to detect when ship enters/exits landing zone
        landingAggregate.body.getCollisionObservable().add((collisionEvent) => {
            // Check if the collision is with our ship
            if (collisionEvent.collider === this._ship.physicsBody) {
                this._isInLandingZone = true;
                debugLog("Ship entered landing zone - resupply active");
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
