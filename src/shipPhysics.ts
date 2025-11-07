import { PhysicsBody, TransformNode, Vector2, Vector3 } from "@babylonjs/core";

// Physics constants
const MAX_LINEAR_VELOCITY = 200;
const MAX_ANGULAR_VELOCITY = 1.4;
const LINEAR_FORCE_MULTIPLIER = 800;
const ANGULAR_FORCE_MULTIPLIER = 15;

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
 * Pure calculation logic with no external dependencies
 */
export class ShipPhysics {
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

        // Get current velocities for velocity cap checks
        const currentLinearVelocity = physicsBody.getLinearVelocity();
        const currentAngularVelocity = physicsBody.getAngularVelocity();
        const currentSpeed = currentLinearVelocity.length();

        let linearMagnitude = 0;
        let angularMagnitude = 0;

        // Apply linear force from left stick Y (forward/backward)
        if (Math.abs(leftStick.y) > 0.1) {
            linearMagnitude = Math.abs(leftStick.y);

            // Only apply force if we haven't reached max velocity
            if (currentSpeed < MAX_LINEAR_VELOCITY) {
                // Get local direction (Z-axis for forward/backward thrust)
                const localDirection = new Vector3(0, 0, -leftStick.y);
                // Transform to world space
                const worldDirection = Vector3.TransformNormal(
                    localDirection,
                    transformNode.getWorldMatrix()
                );
                const force = worldDirection.scale(LINEAR_FORCE_MULTIPLIER);

                // Calculate thrust point: center of mass + offset (0, 1, 0) in world space
                const thrustPoint = Vector3.TransformCoordinates(
                    physicsBody.getMassProperties().centerOfMass.add(new Vector3(0, 1, 0)),
                    transformNode.getWorldMatrix()
                );

                physicsBody.applyForce(force, thrustPoint);
            }
        }

        // Calculate rotation magnitude for torque
        angularMagnitude =
            Math.abs(rightStick.y) +
            Math.abs(rightStick.x) +
            Math.abs(leftStick.x);

        // Apply angular forces if any stick has significant rotation input
        if (angularMagnitude > 0.1) {
            const currentAngularSpeed = currentAngularVelocity.length();

            // Only apply torque if we haven't reached max angular velocity
            if (currentAngularSpeed < MAX_ANGULAR_VELOCITY) {
                const yaw = -leftStick.x;
                const pitch = rightStick.y;
                const roll = rightStick.x;

                // Create torque in local space, then transform to world space
                const localTorque = new Vector3(pitch, yaw, roll).scale(
                    ANGULAR_FORCE_MULTIPLIER
                );
                const worldTorque = Vector3.TransformNormal(
                    localTorque,
                    transformNode.getWorldMatrix()
                );

                physicsBody.applyAngularImpulse(worldTorque);
            }
        }

        return {
            linearMagnitude,
            angularMagnitude,
        };
    }
}
