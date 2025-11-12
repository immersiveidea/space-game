/**
 * Typed event definitions for game analytics
 * Provides type safety and documentation for all tracked events
 */

// ============================================================================
// Session Events
// ============================================================================

export interface SessionStartEvent {
    platform: 'desktop' | 'mobile' | 'vr';
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
}

export interface SessionEndEvent {
    duration: number; // seconds
    totalLevelsPlayed: number;
    totalAsteroidsDestroyed: number;
}

export interface WebXRSessionStartEvent {
    deviceName: string;
    isImmersive: boolean;
}

export interface WebXRSessionEndEvent {
    duration: number; // seconds
    reason: 'user_exit' | 'error' | 'browser_tab_close';
}

// ============================================================================
// Level Events
// ============================================================================

export interface LevelStartEvent {
    levelName: string;
    difficulty: 'recruit' | 'pilot' | 'captain' | 'commander' | 'test';
    playCount: number; // nth time playing this level/difficulty
}

export interface LevelCompleteEvent {
    levelName: string;
    difficulty: string;
    completionTime: number; // seconds
    accuracy: number; // 0-1
    asteroidsDestroyed: number;
    shotsFired: number;
    shotsHit: number;
    hullDamageTaken: number;
    fuelConsumed: number;
    isNewBestTime: boolean;
    isNewBestAccuracy: boolean;
}

export interface LevelFailedEvent {
    levelName: string;
    difficulty: string;
    survivalTime: number; // seconds
    progress: number; // 0-1, percentage of asteroids destroyed
    asteroidsDestroyed: number;
    hullDamageTaken: number;
    causeOfDeath: 'asteroid_collision' | 'out_of_bounds' | 'unknown';
}

// ============================================================================
// Gameplay Events
// ============================================================================

export interface AsteroidDestroyedEvent {
    weaponType: string;
    distance: number;
    asteroidSize: number;
    remainingCount: number;
}

export interface ShotFiredEvent {
    weaponType: string;
    consecutiveShotsCount: number;
}

export interface HullDamageEvent {
    damageAmount: number;
    remainingHull: number;
    damagePercent: number; // 0-1
    source: 'asteroid_collision' | 'environmental';
}

export interface ShipCollisionEvent {
    impactVelocity: number;
    damageDealt: number;
    objectType: 'asteroid' | 'station' | 'boundary';
}

// ============================================================================
// Performance Events
// ============================================================================

export interface PerformanceSnapshotEvent {
    fps: number;
    drawCalls: number;
    activeMeshes: number;
    activeParticleSystems: number;
    physicsStepTime: number; // ms
    renderTime: number; // ms
}

export interface AssetLoadingEvent {
    assetType: 'mesh' | 'texture' | 'audio' | 'system';
    assetName: string;
    loadTimeMs: number;
    success: boolean;
    errorMessage?: string;
}

// ============================================================================
// Error Events
// ============================================================================

export interface JavaScriptErrorEvent {
    errorMessage: string;
    errorStack?: string;
    componentName: string;
    isCritical: boolean;
}

export interface WebXRErrorEvent {
    errorType: 'initialization' | 'controller' | 'session' | 'feature';
    errorMessage: string;
    recoverable: boolean;
}

// ============================================================================
// Progression Events
// ============================================================================

export interface ProgressionUpdateEvent {
    levelName: string;
    difficulty: string;
    bestTime?: number;
    bestAccuracy?: number;
    totalPlays: number;
    firstPlayDate: string;
}

export interface EditorUnlockedEvent {
    timestamp: string;
    levelsCompleted: number;
}

// ============================================================================
// Event Type Map
// ============================================================================

export type GameEventMap = {
    // Session
    session_start: SessionStartEvent;
    session_end: SessionEndEvent;
    webxr_session_start: WebXRSessionStartEvent;
    webxr_session_end: WebXRSessionEndEvent;

    // Level
    level_start: LevelStartEvent;
    level_complete: LevelCompleteEvent;
    level_failed: LevelFailedEvent;

    // Gameplay
    asteroid_destroyed: AsteroidDestroyedEvent;
    shot_fired: ShotFiredEvent;
    hull_damage: HullDamageEvent;
    ship_collision: ShipCollisionEvent;

    // Performance
    performance_snapshot: PerformanceSnapshotEvent;
    asset_loading: AssetLoadingEvent;

    // Errors
    javascript_error: JavaScriptErrorEvent;
    webxr_error: WebXRErrorEvent;

    // Progression
    progression_update: ProgressionUpdateEvent;
    editor_unlocked: EditorUnlockedEvent;
};

/**
 * Type-safe event names
 */
export type GameEventName = keyof GameEventMap;

/**
 * Get the properties type for a specific event name
 */
export type GameEventProperties<T extends GameEventName> = GameEventMap[T];
