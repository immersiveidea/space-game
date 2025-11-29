/**
 * Analytics module exports
 * Convenient barrel export for all analytics functionality
 */

// Core service
export { getAnalytics } from './analyticsService';

// Adapters (interfaces exported as types)
export type { AnalyticsAdapter, EventOptions, AnalyticsConfig } from './adapters/analyticsAdapter';
export type { NewRelicAdapterConfig } from './adapters/newRelicAdapter';

// Event types
export type {
    GameEventName,
    GameEventProperties,
    GameEventMap,
    SessionStartEvent,
    SessionEndEvent,
    WebXRSessionStartEvent,
    WebXRSessionEndEvent,
    LevelStartEvent,
    LevelCompleteEvent,
    LevelFailedEvent,
    AsteroidDestroyedEvent,
    ShotFiredEvent,
    HullDamageEvent,
    ShipCollisionEvent,
    PerformanceSnapshotEvent,
    AssetLoadingEvent,
    JavaScriptErrorEvent,
    WebXRErrorEvent,
    ProgressionUpdateEvent,
    EditorUnlockedEvent
} from './events/gameEvents';
