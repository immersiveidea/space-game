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

## Important Implementation Notes

- Never modify git config or use force push operations
- Deploy target hostname: `www.flatearhdefense.com` (from package.json)
- TypeScript target is ES6 with ESNext modules
- Vite handles bundling and dev server (though dev mode is disabled per user preference)
- Inspector can be toggled with 'i' key for debugging (only in development)
- https://dev.flatearthdefense.com  is local development, it's proxied back to my localhost which is running npm run dev

## Coding Standards
- files should be under 100 lines.  If they exceed 100 lines please suggest refactoring into multiple files
- functions and methods should be under 20 lines.  If they exceed 20 lines, suggest reefactoring.
- game should be able to reload and restart via a deep link and page refresh.  If there are reasons this won't work or we're making a change the breaks this, don't do it.
- unused imports, functions, methods, and classes should have a comment added explaining why it's unused.
