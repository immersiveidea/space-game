# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebXR-based space shooter game built with BabylonJS, designed for VR headsets (primarily Meta Quest 2). Players pilot a spaceship through asteroid fields with multiple difficulty levels, using VR controllers for movement and shooting.

## Development Commands

```bash
# Build the project (TypeScript compilation + Vite build)
npm run build

# Preview production build locally
npm run preview

# Copy Havok physics WASM file (needed after clean installs)
npm run havok

# Generate speech audio files (requires OpenAI API)
npm run speech
```

**Note**: Do not run `npm run dev` per global user instructions.

## Core Architecture

### Scene Management Pattern
The project uses a singleton pattern for scene access via `DefaultScene`:
- `DefaultScene.MainScene` - Primary game scene
- `DefaultScene.DemoScene` - Demo/attract mode scene
- `DefaultScene.XR` - WebXR experience instance

All game objects reference these static properties rather than passing scene instances.

### Level System
Levels implement the `Level` interface with:
- `initialize()` - Setup level geometry and physics
- `play()` - Start level gameplay
- `dispose()` - Cleanup
- `getReadyObservable()` - Async loading notification

Current implementation: `Level1` with 5 difficulty modes (recruit, pilot, captain, commander, test)

### Ship and Controller System
The `Ship` class manages:
- Player spaceship rendering and physics
- VR controller input handling (Meta Quest 2 controllers)
- Weapon firing system
- Audio for thrust and weapons
- Camera parent transform for VR positioning

Controllers are added dynamically via WebXR observables when detected.

### Physics and Collision
- Uses Havok Physics engine (WASM-based)
- Fixed timestep: 1/45 second with 5 sub-steps
- Zero gravity environment
- Collision detection for projectiles vs asteroids
- Physics bodies use `PhysicsAggregate` pattern

### Asteroid Factory Pattern
`RockFactory` uses:
- Pre-loaded mesh instances for performance
- Particle system pooling for explosions (pool size: 10)
- Observable pattern for score events via collision callbacks
- Dynamic spawning based on difficulty configuration

### Rendering Optimization
The codebase uses rendering groups to control draw order:
- Group 1: Particle effects (explosions)
- Group 3: Ship cockpit and UI (always rendered on top)

This prevents z-fighting and ensures HUD elements are always visible in VR.

### Audio Architecture
Uses BabylonJS AudioEngineV2:
- Requires unlock via user interaction before VR entry
- Spatial audio for thrust sounds
- StaticSound for weapon fire
- Audio engine passed to Level and Ship constructors

### Difficulty System
Each difficulty level configures:
- `rockCount` - Number of asteroids to destroy
- `forceMultiplier` - Asteroid movement speed
- `rockSizeMin/Max` - Size range of asteroids
- `distanceMin/Max` - Spawn distance from player

Located in `level1.ts:getDifficultyConfig()`

## Key Technical Constraints

### WebXR Requirements
- Must have `navigator.xr` support
- Controllers are added asynchronously via observables
- Camera must be parented to ship transform before entering VR
- XR features enabled: LAYERS with multiview for performance

### Asset Loading
- 3D models: GLB format (cockpit, asteroids)
- Particle systems: JSON format in `public/systems/`
- Planet textures: Organized by biome in `public/planetTextures/`
- Audio: MP3 format in public root

### Performance Considerations
- Hardware scaling set to match device pixel ratio
- Particle system pooling prevents allocation during gameplay
- Instance meshes used where possible
- Physics sub-stepping for stability without high timestep cost

## Project Structure

```
src/
  main.ts              - Entry point, game initialization, WebXR setup
  defaultScene.ts      - Singleton scene accessor
  level.ts             - Level interface
  level1.ts            - Main game level implementation
  ship.ts              - Player ship, controls, weapons
  rockFactory.ts         - Rock factory and collision handling
  scoreboard.ts        - In-cockpit HUD display
  createSun.ts         - Sun mesh generation
  createPlanets.ts     - Procedural planet generation
  planetTextures.ts    - Planet texture library
  demo.ts              - Attract mode implementation

public/
  systems/             - Particle system definitions
  planetTextures/      - Biome-based planet textures
  cockpit*.glb         - Ship interior models
  asteroid*.glb        - Asteroid mesh variants
  *.mp3                - Audio assets
```

## Important Implementation Notes

- Never modify git config or use force push operations
- Deploy target hostname: `space.digital-experiment.com` (from package.json)
- TypeScript target is ES6 with ESNext modules
- Vite handles bundling and dev server (though dev mode is disabled per user preference)
- Inspector can be toggled with 'i' key for debugging (only in development)
