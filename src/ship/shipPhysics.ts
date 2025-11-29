import { PhysicsBody, TransformNode, Vector2, Vector3 } from "@babylonjs/core";
import { GameConfig } from "../core/gameConfig";
import { ShipStatus } from "./shipStatus";
import { GameStats } from "../game/gameStats";

interface InputState {
    leftStick: Vector2;
    rightStick: Vector2;
}

interface ForceApplicationResult {
    linearMagnitude: number;
    angularMagnitude: number;
}

/**
 * Handles physics force calculations and application for the ship
 * Reads physics parameters from GameConfig for runtime tuning
 */
export class ShipPhysics {
    private _shipStatus: ShipStatus | null = null;
    private _gameStats: GameStats | null = null;
    private _config = GameConfig.getInstance().shipPhysics;
    /**
     * Set the ship status instance for fuel consumption tracking
     */
    public setShipStatus(shipStatus: ShipStatus): void {
        this._shipStatus = shipStatus;
    }

    /**
     * Set the game stats instance for tracking fuel consumed
     */
    public setGameStats(gameStats: GameStats): void {
        this._gameStats = gameStats;
    }
    /**
     * Apply forces to the ship based on input state
     * @param inputState - Current input state (stick positions)
     * @param physicsBody - Physics body to apply forces to
     * @param transformNode - Transform node for world space calculations
     * @returns Force magnitudes for audio feedback
     */
    public applyForces(
        inputState: InputState,
        physicsBody: PhysicsBody,
        transformNode: TransformNode
    ): ForceApplicationResult {
        if (!physicsBody) {
            return { linearMagnitude: 0, angularMagnitude: 0 };
        }
        const { leftStick, rightStick } = inputState;

        // Get physics config


        // Get current velocities for velocity cap checks
        const currentLinearVelocity = physicsBody.getLinearVelocity();
        const currentAngularVelocity = physicsBody.getAngularVelocity();
        const currentSpeed = currentLinearVelocity.length();

        let linearMagnitude = 0;

        // Apply linear force from left stick Y (forward/backward)
        if (Math.abs(leftStick.y) > 0.15) {
            linearMagnitude = Math.abs(leftStick.y);

            // Check if we have fuel before applying force
            if (this._shipStatus && this._shipStatus.fuel > 0) {
                // Only apply force if we haven't reached max velocity
                if (currentSpeed < this._config.maxLinearVelocity) {
                    // Get local direction (Z-axis for forward/backward thrust)
                    const thrustDirection = -leftStick.y; // negative = forward, positive = reverse
                    const localDirection = new Vector3(0, 0, thrustDirection);

                    // Transform to world space
                    const worldDirection = Vector3.TransformNormal(
                        localDirection,
                        transformNode.getWorldMatrix()
                    );

                    // Apply reverse thrust factor: forward at full power, reverse at reduced power
                    const thrustMultiplier = thrustDirection > 0
                        ? 1.0  // Forward thrust at full power
                        : this._config.reverseThrustFactor;  // Reverse thrust scaled down

                    const force = worldDirection.scale(
                        this._config.linearForceMultiplier * thrustMultiplier
                    );

                    // Apply force at ship's world position (center of mass)
                    // Since we overrode center of mass to (0,0,0) in local space, the transform origin is the CoM
                    // Using getAbsolutePosition() instead of transforming CoM avoids gyroscopic coupling during rotation
                    const thrustPoint = transformNode.getAbsolutePosition();

                    physicsBody.applyForce(force, thrustPoint);

                    // Consume fuel based on config rate (tuned for 1 minute at full thrust)
                    const fuelConsumption = linearMagnitude * this._config.linearFuelConsumptionRate;
                    this._shipStatus.consumeFuel(fuelConsumption);

                    // Track fuel consumed for statistics
                    if (this._gameStats) {
                        this._gameStats.recordFuelConsumed(fuelConsumption);
                    }
                }
            }
        }

        // Calculate rotation magnitude for torque
        let angularMagnitude =
            Math.abs(rightStick.y) +
            Math.abs(rightStick.x) +
            Math.abs(leftStick.x);

        // Apply angular forces if any stick has significant rotation input
        if (angularMagnitude > 0.1) {
            // Check if we have fuel before applying torque
            if (this._shipStatus && this._shipStatus.fuel > 0) {
                const currentAngularSpeed = currentAngularVelocity.length();

                // Only apply torque if we haven't reached max angular velocity
                if (currentAngularSpeed < this._config.maxAngularVelocity) {
                    const yaw = -leftStick.x;
                    const pitch = rightStick.y;
                    const roll = rightStick.x;

                    // Create torque in local space, then transform to world space
                    const localTorque = new Vector3(pitch, yaw, roll).scale(
                        this._config.angularForceMultiplier
                    );
                    const worldTorque = Vector3.TransformNormal(
                        localTorque,
                        transformNode.getWorldMatrix()
                    );

                    // Note: Havok only exposes angular impulse, not torque
                    // Babylon.js implements applyForce() as: impulse = force * timeStep
                    // We do the same for angular: scale torque by physics timestep (1/60)
                    // Since we call this every 10 frames, we accumulate 10 timesteps worth
                    physicsBody.applyAngularImpulse(worldTorque);

                    // Consume fuel based on config rate (tuned for 2 minutes at full thrust)
                    const normalizedAngularMagnitude = Math.min(angularMagnitude / 3.0, 1.0);
                    const fuelConsumption = normalizedAngularMagnitude * this._config.angularFuelConsumptionRate;
                    this._shipStatus.consumeFuel(fuelConsumption);

                    // Track fuel consumed for statistics
                    if (this._gameStats) {
                        this._gameStats.recordFuelConsumed(fuelConsumption);
                    }
                }
            }
        }

        return {
            linearMagnitude,
            angularMagnitude,
        };
    }
}
