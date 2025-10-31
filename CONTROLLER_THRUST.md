# Controller Thrust System Analysis

## Overview

The ship's thrust system uses VR controller thumbsticks to apply physics forces and torques to the ship. The system applies forces gradually up to a maximum velocity, providing momentum-based movement with velocity caps.

## Control Mapping

### Left Thumbstick
- **Y Axis (up/down)**: Linear thrust forward/backward
- **X Axis (left/right)**: Yaw rotation (turning left/right)

### Right Thumbstick
- **Y Axis (up/down)**: Pitch rotation (nose up/down)
- **X Axis (left/right)**: Roll rotation (barrel roll)

### Trigger
- Fires weapons

---

## Constants & Configuration

Located in `src/ship.ts:26-29`:

```typescript
const MAX_LINEAR_VELOCITY = 80;      // Maximum forward/backward speed
const MAX_ANGULAR_VELOCITY = 1.9;    // Maximum rotation speed
const LINEAR_FORCE_MULTIPLIER = 600; // Thrust force strength
const ANGULAR_FORCE_MULTIPLIER = 18; // Torque strength
```

---

## Linear Thrust Implementation

### Code Location
`src/ship.ts:321-366` - Inside `updateVelocity()` method

### How It Works

1. **Input Detection**: Checks if left stick Y axis has significant deflection (`> 0.01`)

2. **Velocity Check**: Gets current speed from physics body
   ```typescript
   const currentSpeed = currentLinearVelocity.length();
   ```

3. **Force Calculation**:
   ```typescript
   const forceDirection = this._ship.forward.scale(-this._leftStickVector.y);
   const force = forceDirection.scale(LINEAR_FORCE_MULTIPLIER);
   ```

4. **Force Application**: Only applies force if below max velocity
   ```typescript
   if (currentSpeed < MAX_LINEAR_VELOCITY) {
       body.applyForce(force, this._ship.absolutePosition);
   }
   ```

5. **Velocity Clamping**: After force application, clamps total velocity
   ```typescript
   if (currentSpeed > MAX_LINEAR_VELOCITY) {
       const clampedVelocity = currentLinearVelocity.normalize().scale(MAX_LINEAR_VELOCITY);
       body.setLinearVelocity(clampedVelocity);
   }
   ```

### Key Assumptions About Babylon.js APIs

#### ✅ VERIFIED from code and user confirmation:
- `this._ship.forward` returns a unit vector in **local space** (NOT world space)
- `body.getLinearVelocity()` returns current velocity vector in world space
- `body.applyForce(force, position)` applies force at a point (standard physics API)
- `body.applyForce()` expects forces in **world space** coordinates

#### ⚠️ ASSUMED (not verified from documentation):
- `this._ship.absolutePosition` is the correct point to apply force for center-of-mass thrust

### Current Issues

**CRITICAL PROBLEM #1**: `this._ship.forward` returns a vector in **local space**, but `body.applyForce()` expects **world space** coordinates. The local direction vector must be transformed to world space before applying force.

**What's happening**:
- `this._ship.forward` = Local -Z axis vector (NOT in world space)
- This local vector is passed directly to `applyForce()` which expects world space
- Force is applied incorrectly because of coordinate space mismatch

**What's needed**:
- Use Z-axis for forward/backward thrust (matches bullet direction)
- Transform local direction to world space using `Vector3.TransformNormal(localDir, this._ship.getWorldMatrix())`

---

## Angular Thrust Implementation

### Code Location
`src/ship.ts:368-440` - Inside `updateVelocity()` method

### How It Works

1. **Input Collection**:
   ```typescript
   const yaw = this._leftStickVector.x;    // Left stick X
   const pitch = -this._rightStickVector.y; // Right stick Y (inverted)
   const roll = -this._rightStickVector.x;  // Right stick X (inverted)
   ```

2. **Torque Calculation**:
   ```typescript
   const torque = new Vector3(pitch, yaw, roll).scale(ANGULAR_FORCE_MULTIPLIER);
   ```

3. **Apply Angular Impulse**:
   ```typescript
   body.applyAngularImpulse(torque);
   ```

4. **Angular Velocity Clamping**:
   ```typescript
   if (currentAngularSpeed > MAX_ANGULAR_VELOCITY) {
       const clampedAngularVelocity = currentAngularVelocity.normalize().scale(MAX_ANGULAR_VELOCITY);
       body.setAngularVelocity(clampedAngularVelocity);
   }
   ```

### Key Assumptions About Babylon.js APIs

#### ✅ VERIFIED from code:
- Angular impulse is applied every frame based on stick input
- Angular velocity is clamped to maximum rotation speed

#### ⚠️ ASSUMED (not verified):
- `body.applyAngularImpulse(torque)` expects torque vector in **world space** coordinates
- The torque vector components `(X, Y, Z)` directly map to rotation around world axes
- Angular impulse accumulates with existing angular velocity

### Current Issues

**CRITICAL PROBLEM**: The torque is being constructed as a simple vector `(pitch, yaw, roll)` in what appears to be local space, but `body.applyAngularImpulse()` expects **world space** coordinates.

**What's happening**:
- Torque = `Vector3(pitch, yaw, roll)` - intended as local space rotations
- Passed directly to `applyAngularImpulse()` which expects world space
- Ship rotates around wrong axes because of coordinate space mismatch

**What's needed**:
- Define torque in local space: X=pitch, Y=yaw, Z=roll
- Transform to world space before applying
- Pitch: Rotation around ship's local X-axis (right vector)
- Yaw: Rotation around ship's local Y-axis (up vector)
- Roll: Rotation around ship's local Z-axis (forward vector)

**Required Fix**: Transform the torque from local space to world space:
```typescript
const localTorque = new Vector3(pitch, yaw, roll).scale(ANGULAR_FORCE_MULTIPLIER);
const worldTorque = Vector3.TransformNormal(localTorque, this._ship.getWorldMatrix());
body.applyAngularImpulse(worldTorque);
```

---

## Debug Visualization

### Activation
- Press `d` key to toggle debug mode (currently defaults to ON)
- Debug lines are drawn in rendering group 3 (always on top)

### Visual Indicators

**Linear Force** (Yellow line):
- Drawn from camera position
- Shows direction and magnitude of thrust force
- Only visible when applying forward/backward thrust

**Angular Forces**:
- **Red line**: Pitch torque around ship's right axis (X)
- **Green line**: Yaw torque around ship's up axis (Y)
- **Blue line**: Roll torque around ship's forward axis (Z)

### Debug Visualization Code Location
`src/ship.ts:221-232` - `drawDebugVector()` method

### How Debug Lines Are Positioned

```typescript
const cameraPos = this._camera.globalPosition.clone();
const cameraForward = this._camera.getFrontPosition(1);
const start = cameraPos.add(cameraForward.scale(1)).add(offset);
```

#### ⚠️ ASSUMPTION:
- `this._camera.getFrontPosition(1)` returns a position 1 unit in front of camera
- This is not a standard Babylon.js API method (expected `getDirection()` instead)
- May be causing debug lines to not render correctly

---

## Physics Body Properties

The ship physics body is configured with:

```typescript
mass: 100
linearDamping: 0.1    // Causes gradual velocity decay
angularDamping: 0.2   // Causes gradual rotation decay
motionType: DYNAMIC   // Affected by forces and gravity (if enabled)
```

### How Damping Affects Movement

**Linear Damping (0.1)**:
- When no thrust is applied, ship gradually slows down
- 10% velocity reduction per physics step (approximate)
- Creates "drag in space" effect

**Angular Damping (0.2)**:
- When no rotation input, ship gradually stops spinning
- 20% angular velocity reduction per physics step (approximate)
- Prevents indefinite spinning

---

## Expected Behavior vs Current Implementation

### Linear Thrust

| Expected | Current Implementation | Status |
|----------|----------------------|--------|
| Thrust along local Z-axis | Thrust along local Z-axis (forward) | ✅ **CORRECT** |
| Gradual acceleration | ✅ Applies force up to max velocity | ✅ Correct |
| Velocity clamping | ✅ Clamps to MAX_LINEAR_VELOCITY | ✅ Correct |
| World-space force | ✅ Transforms to world space | ✅ **CORRECT** |

### Angular Thrust

| Expected | Current Implementation | Status |
|----------|----------------------|--------|
| Rotation around local axes | ✅ Transforms to world space | ✅ **CORRECT** |
| Torque transformation | ✅ Uses Vector3.TransformNormal | ✅ **CORRECT** |
| Velocity clamping | ✅ Clamps angular velocity | ✅ Correct |

---

## Audio Feedback

### Primary Thrust Sound
- Triggered when left stick Y > 0.1
- Volume scales with stick deflection
- Looping thrust sound

### Secondary Thrust Sound
- Triggered when any rotation input detected
- Volume scales with combined rotation input magnitude
- Looping thrust sound

---

## Recommended Fixes

### 1. Fix Linear Thrust Direction and Coordinate Space ✅ FIXED
**Changed** from:
```typescript
const forceDirection = this._ship.forward.scale(-this._leftStickVector.y);
const force = forceDirection.scale(LINEAR_FORCE_MULTIPLIER);
```

To:
```typescript
// Get local direction (Z-axis for forward/backward thrust)
const localDirection = new Vector3(0, 0, -this._leftStickVector.y);
// Transform to world space
const worldDirection = Vector3.TransformNormal(localDirection, this._ship.getWorldMatrix());
const force = worldDirection.scale(LINEAR_FORCE_MULTIPLIER);
```

### 2. Fix Angular Thrust Coordinate Space
**Change lines 382-383** from:
```typescript
const torque = new Vector3(pitch, yaw, roll).scale(ANGULAR_FORCE_MULTIPLIER);
body.applyAngularImpulse(torque);
```

To:
```typescript
const localTorque = new Vector3(pitch, yaw, roll).scale(ANGULAR_FORCE_MULTIPLIER);
const worldTorque = Vector3.TransformNormal(localTorque, this._ship.getWorldMatrix());
body.applyAngularImpulse(worldTorque);
```

### 3. Fix Debug Visualization Camera Method
**Change line 224** from:
```typescript
const cameraForward = this._camera.getFrontPosition(1);
```

To:
```typescript
const cameraForward = this._camera.getDirection(Vector3.Forward());
```

---

## Open Questions

1. **Force Application Point**: Is `this._ship.absolutePosition` the center of mass, or should force be applied at a specific offset?

2. **Coordinate System Convention**: What is the ship's default orientation in local space?
   - Is +Y up, +Z forward, +X right? (Standard)
   - Or does the ship model use a different convention?

3. **Angular Impulse vs Torque**: Should we use `applyAngularImpulse()` or a continuous torque application method?

4. **Velocity Check Logic**: Currently checks total speed before applying force. Should we instead check velocity component in the thrust direction?

---

## Testing Recommendations

With debug mode enabled, verify:

1. **Yellow thrust line** points in intended thrust direction when moving stick
2. **Red/Green/Blue rotation lines** show rotation axes correctly aligned with ship orientation
3. Ship accelerates smoothly without hitting velocity cap too quickly
4. Ship rotates around its own axes, not around world axes
5. Damping brings ship to rest when sticks are released
