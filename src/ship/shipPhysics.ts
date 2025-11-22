import { PhysicsBody, TransformNode, Vector2, Vector3 } from "@babylonjs/core";
import { GameConfig } from "../core/gameConfig";
import { ShipStatus } from "./shipStatus";
import { GameStats } from "../game/gameStats";

export interface InputState {
    leftStick: Vector2;
    rightStick: Vector2;
}

export interface ForceApplicationResult {
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
        let angularMagnitude = 0;

        // Apply linear force from left stick Y (forward/backward)
        if (Math.abs(leftStick.y) > 0.1) {
            linearMagnitude = Math.abs(leftStick.y);

            // Check if we have fuel before applying force
            if (this._shipStatus && this._shipStatus.fuel > 0) {
                // Only apply force if we haven't reached max velocity
                if (currentSpeed < this._config.maxLinearVelocity) {
                    // Get local direction (Z-axis for forward/backward thrust)
                    const localDirection = new Vector3(0, 0, -leftStick.y);
                    // Transform to world space
                    const worldDirection = Vector3.TransformNormal(
                        localDirection,
                        transformNode.getWorldMatrix()
                    );
                    const force = worldDirection.scale(this._config.linearForceMultiplier);

                    // Calculate thrust point: center of mass + offset (0, 1, 0) in world space
                    const thrustPoint = Vector3.TransformCoordinates(
                        physicsBody.getMassProperties().centerOfMass.add(new Vector3(0, 1, 0)),
                        transformNode.getWorldMatrix()
                    );

                    physicsBody.applyForce(force, thrustPoint);

                    // Consume fuel: normalized magnitude (0-1) * 0.005 per frame
                    const fuelConsumption = linearMagnitude * 0.005;
                    this._shipStatus.consumeFuel(fuelConsumption);

                    // Track fuel consumed for statistics
                    if (this._gameStats) {
                        this._gameStats.recordFuelConsumed(fuelConsumption);
                    }
                }
            }
        }

        // Calculate rotation magnitude for torque
        angularMagnitude =
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

                    physicsBody.applyAngularImpulse(worldTorque);

                    // Consume fuel: normalized magnitude (0-3 max) / 3 * 0.005 per frame
                    const normalizedAngularMagnitude = Math.min(angularMagnitude / 3.0, 1.0);
                    const fuelConsumption = normalizedAngularMagnitude * 0.005;
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
