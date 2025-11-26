# Known Bugs

## Low Priority

### Camera briefly faces backwards when entering VR
**Status:** Open
**Priority:** Low

When entering immersive VR mode, the camera briefly shows the wrong direction (facing backwards) before correcting itself. This is due to the ship GLB model being exported with an inverted orientation (facing -Z instead of +Z).

**Root Cause:**
- The ship.glb model's forward direction is inverted
- When the XR camera is parented to the ship with rotation (0,0,0), it inherits this inverted orientation
- There's a timing gap between entering XR and properly configuring the camera

**Potential Solutions:**
1. Re-export the ship.glb model with correct orientation
2. Stop render loop before entering XR, resume after camera is configured (partially implemented)
3. Rotate camera 180° around Y axis to compensate for inverted model
4. Add a fade-to-black transition when entering VR to hide the orientation flash

**Affected Files:**
- `src/main.ts` - XR entry and camera parenting
- `src/levels/level1.ts` - onInitialXRPoseSetObservable camera setup
- `src/ship/ship.ts` - Flat camera setup
- `public/ship.glb` - The inverted model
