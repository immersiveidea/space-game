# Immersive Level Progression Plan

## Overview
Add the ability for players to progress to the next level while staying in VR/immersive mode. This includes a "NEXT LEVEL" button on the status screen, fade-to-black transition, proper cleanup, and mission brief display.

## User Requirements
- Show mission brief for the new level
- Use fade-to-black transition (smoother UX)
- Reset all game statistics for each level
- Maintain deep-link reload capability

---

## Implementation Approach

### Architecture Decision: Create LevelTransitionManager

Create a new singleton class rather than adding to existing code because:
1. Keeps transition logic isolated (~90 lines)
2. Avoids bloating statusScreen.ts (already 700 lines)
3. Single responsibility principle
4. Follows existing patterns (InputControlManager, ProgressionManager)

---

## Phase 1: Create VR Fade Effect

**New file: `src/ui/effects/vrFadeEffect.ts`** (~60 lines)

For VR, use a black sphere that surrounds the XR camera (2D post-process won't work correctly for stereo rendering):

- Create small sphere (0.5m diameter) parented to XR camera
- Material: pure black, `backFaceCulling = false` (see inside)
- `renderingGroupId = 3` (render in front of everything)
- Animate alpha 0→1 for fadeOut, 1→0 for fadeIn
- Use BabylonJS Animation class with 500ms duration

---

## Phase 2: Create Level Transition Manager

**New file: `src/core/levelTransitionManager.ts`** (~90 lines)

Singleton that orchestrates the transition sequence:

```
transitionToLevel(nextLevelSlug):
  1. Initialize fade sphere (parent to XR camera)
  2. fadeOut(500ms) - screen goes black
  3. currentLevel.dispose() - cleanup all entities
  4. RockFactory.reset() then init() - reset asteroid factory
  5. Get new level config from LevelRegistry
  6. Create new Level1(config, audioEngine, false, levelSlug)
  7. newLevel.initialize() - creates ship, asteroids, etc.
  8. newLevel.setupXRCamera() - re-parent XR camera to new ship
  9. fadeIn(500ms) - reveal new scene
  10. newLevel.showMissionBrief() - show objectives
  11. (Player clicks START on mission brief)
  12. newLevel.startGameplay() - timer begins
```

Key considerations:
- Store reference to audioEngine (passed once, reused)
- Store reference to currentLevel (updated on transition)
- XR session stays active throughout
- Physics engine stays active (bodies are disposed, not engine)

---

## Phase 3: Enable NEXT LEVEL Button on StatusScreen

**File: `src/ui/hud/statusScreen.ts`**

### 3a. Uncomment button code (lines 248-262)

Currently commented out NEXT LEVEL button exists. Uncomment and add hover effect:

```typescript
this._nextLevelButton = Button.CreateSimpleButton("nextLevelButton", "NEXT LEVEL");
this._nextLevelButton.width = "300px";
this._nextLevelButton.height = "60px";
this._nextLevelButton.color = "white";
this._nextLevelButton.background = "#0088ff";
this._nextLevelButton.cornerRadius = 10;
this._nextLevelButton.thickness = 0;
this._nextLevelButton.fontSize = "30px";
this._nextLevelButton.fontWeight = "bold";
addButtonHoverEffect(this._nextLevelButton, "#0088ff", "#00aaff");  // ADD THIS
this._nextLevelButton.onPointerClickObservable.add(() => {
    if (this._onNextLevelCallback) {
        this._onNextLevelCallback();
    }
});
buttonBar.addControl(this._nextLevelButton);
```

### 3b. Verify visibility logic (around line 474)

Existing logic should handle button visibility on victory:
```typescript
if (this._nextLevelButton) {
    this._nextLevelButton.isVisible = isGameEnded && victory && hasNextLevel;
}
```

Ensure `hasNextLevel` is properly checked using ProgressionManager.getNextLevel().

---

## Phase 4: Modify Ship.handleNextLevel()

**File: `src/ship/ship.ts`** (lines 523-528)

Change from page reload to using LevelTransitionManager:

```typescript
private async handleNextLevel(): Promise<void> {
    log.debug('Next Level button clicked - transitioning to next level');

    const { ProgressionManager } = await import('../game/progression');
    const progression = ProgressionManager.getInstance();
    const nextLevel = progression.getNextLevel();

    if (nextLevel) {
        const { LevelTransitionManager } = await import('../core/levelTransitionManager');
        const transitionManager = LevelTransitionManager.getInstance();
        await transitionManager.transitionToLevel(nextLevel);
    }
}
```

---

## Phase 5: Wire Up LevelTransitionManager

**File: `src/core/handlers/levelSelectedHandler.ts`** or `src/main.ts`

After level is created, register it with the transition manager:

```typescript
import { LevelTransitionManager } from './core/levelTransitionManager';

// After level creation:
const transitionManager = LevelTransitionManager.getInstance();
transitionManager.setAudioEngine(audioEngine);
transitionManager.setCurrentLevel(level);
```

---

## Cleanup Details

### Gap Found: Sun, Planets, Asteroids Not Tracked

**Issue**: In `Level1.initialize()` (line 393), the comment says "sun and planets are already created by deserializer" but they are NOT stored as instance variables. This means they won't be disposed when switching levels.

**Fix Required**: Add new instance variables and dispose them:

```typescript
// Add to Level1 class properties:
private _sun: AbstractMesh | null = null;
private _planets: AbstractMesh[] = [];
private _asteroids: AbstractMesh[] = [];

// In initialize(), store the returned entities:
this._sun = entities.sun;
this._planets = entities.planets;
this._asteroids = entities.asteroids;

// In dispose(), add cleanup:
if (this._sun) this._sun.dispose();
this._planets.forEach(p => p.dispose());
this._asteroids.forEach(a => { if (!a.isDisposed()) a.dispose(); });
```

### What gets disposed (via Level1.dispose()):
- `_startBase` - landing base mesh
- `_endBase` - end base mesh (if exists)
- `_sun` - **NEW** sun mesh
- `_planets` - **NEW** planet meshes array
- `_asteroids` - **NEW** asteroid meshes (may already be destroyed in gameplay)
- `_backgroundStars` - particle system
- `_missionBrief` - UI overlay
- `_hintSystem` - audio hints
- `_ship` - cascades to: physics body, controllers, audio, weapons, statusScreen, scoreboard
- `_backgroundMusic` - audio

### What stays active:
- XR session
- XR camera (re-parented to new ship)
- Audio engine
- Main scene
- Physics engine (bodies disposed, engine stays)
- Render loop

### RockFactory reset:
- `RockFactory.reset()` clears static asteroid mesh references
- `RockFactory.init()` reloads base asteroid models
- Ensures fresh asteroid creation for new level

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `src/ui/effects/vrFadeEffect.ts` | CREATE - VR fade sphere effect (~60 lines) |
| `src/core/levelTransitionManager.ts` | CREATE - Transition orchestration (~90 lines) |
| `src/ui/hud/statusScreen.ts` | MODIFY - Uncomment NEXT LEVEL button, add hover effect |
| `src/ship/ship.ts` | MODIFY - Update handleNextLevel() to use transition manager |
| `src/levels/level1.ts` | MODIFY - Add _sun, _planets, _asteroids properties and dispose them |
| `src/main.ts` or handler | MODIFY - Wire up transition manager on level creation |

---

## Transition Sequence Diagram

```
[Victory] → StatusScreen shows NEXT LEVEL button
              ↓
        Player clicks NEXT LEVEL
              ↓
        Ship.handleNextLevel()
              ↓
        LevelTransitionManager.transitionToLevel()
              ↓
        VRFadeEffect.fadeOut(500ms) ← Screen goes black
              ↓
        Level1.dispose() ← All entities cleaned up
              ↓
        RockFactory.reset() + init()
              ↓
        new Level1(newConfig) ← New level created
              ↓
        Level1.initialize() ← Asteroids, ship, bases created
              ↓
        Level1.setupXRCamera() ← Camera re-parented
              ↓
        VRFadeEffect.fadeIn(500ms) ← Scene revealed
              ↓
        Level1.showMissionBrief() ← Objectives displayed
              ↓
        Player clicks START
              ↓
        Level1.startGameplay() ← Timer starts, gameplay begins
```

---

## Testing Checklist

1. NEXT LEVEL button appears only on victory when next level exists and is unlocked
2. Clicking button starts fade transition
3. XR session remains active throughout
4. Old level entities fully disposed (no memory leaks)
5. New level loads with correct configuration
6. XR camera re-parents to new ship correctly
7. Mission brief displays for new level
8. GameStats reset (time starts at 0:00)
9. Ship status (fuel/hull/ammo) reset to full
10. Deep-link reload still works (page refresh loads correct level)
11. Scoreboard shows correct asteroid count
12. Physics bodies cleaned up (no orphaned bodies)
13. Audio continues working (background music, effects)
14. Controllers work on new ship
