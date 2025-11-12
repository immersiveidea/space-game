/**
 * Base interface for analytics adapters
 * Implement this interface to create adapters for different analytics providers
 */

export interface EventOptions {
    /** Send immediately without batching */
    immediate?: boolean;
    /** Sample rate (0-1). 0.1 = 10% of events sent */
    sampleRate?: number;
}

export interface EventMetadata {
    timestamp: number;
    sessionId: string;
    [key: string]: any;
}

export interface AnalyticsEvent {
    name: string;
    properties: Record<string, any>;
    metadata: EventMetadata;
    options?: EventOptions;
}

/**
 * Base adapter interface that all analytics providers must implement
 */
export interface AnalyticsAdapter {
    /** Unique identifier for this adapter */
    readonly name: string;

    /** Initialize the adapter */
    initialize(config?: Record<string, any>): void;

    /** Track an event */
    track(event: AnalyticsEvent): void;

    /** Flush any pending events immediately */
    flush(): void;

    /** Cleanup and send final events before shutdown */
    shutdown(): void;
}

/**
 * Configuration options for analytics service
 */
export interface AnalyticsConfig {
    /** Enable/disable analytics globally */
    enabled?: boolean;

    /** Automatically add session metadata to all events */
    includeSessionMetadata?: boolean;

    /** Debug mode - log events to console */
    debug?: boolean;

    /** Custom session ID (auto-generated if not provided) */
    sessionId?: string;
}
