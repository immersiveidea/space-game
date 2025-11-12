import { AnalyticsAdapter, AnalyticsConfig, EventMetadata, EventOptions } from './adapters/analyticsAdapter';
import { GameEventName, GameEventProperties } from './events/gameEvents';

/**
 * Central analytics service with pluggable adapters
 * Singleton pattern for global access
 */
export class AnalyticsService {
    private static instance: AnalyticsService | null = null;

    private adapters: AnalyticsAdapter[] = [];
    private config: Required<AnalyticsConfig>;
    private sessionId: string;
    private sessionStartTime: number;

    private constructor(config: AnalyticsConfig = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            includeSessionMetadata: config.includeSessionMetadata ?? true,
            debug: config.debug ?? false,
            sessionId: config.sessionId ?? this.generateSessionId()
        };

        this.sessionId = this.config.sessionId;
        this.sessionStartTime = Date.now();

        this.log('AnalyticsService initialized', {
            sessionId: this.sessionId,
            enabled: this.config.enabled
        });
    }

    // ========================================================================
    // Singleton Management
    // ========================================================================

    static initialize(config?: AnalyticsConfig): AnalyticsService {
        if (AnalyticsService.instance) {
            console.warn('AnalyticsService already initialized');
            return AnalyticsService.instance;
        }

        AnalyticsService.instance = new AnalyticsService(config);
        return AnalyticsService.instance;
    }

    static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            throw new Error('AnalyticsService not initialized. Call initialize() first.');
        }
        return AnalyticsService.instance;
    }

    // ========================================================================
    // Adapter Management
    // ========================================================================

    addAdapter(adapter: AnalyticsAdapter): void {
        this.log(`Adding adapter: ${adapter.name}`);
        this.adapters.push(adapter);
        adapter.initialize();
    }

    removeAdapter(adapterName: string): void {
        const index = this.adapters.findIndex(a => a.name === adapterName);
        if (index !== -1) {
            this.log(`Removing adapter: ${adapterName}`);
            this.adapters[index].shutdown();
            this.adapters.splice(index, 1);
        }
    }

    getAdapter(name: string): AnalyticsAdapter | undefined {
        return this.adapters.find(a => a.name === name);
    }

    // ========================================================================
    // Event Tracking (Type-Safe)
    // ========================================================================

    /**
     * Track a game event with full type safety
     * @param eventName - Name of the event from GameEventMap
     * @param properties - Type-safe properties for the event
     * @param options - Optional event options (immediate, sampleRate)
     */
    track<T extends GameEventName>(
        eventName: T,
        properties: GameEventProperties<T>,
        options?: EventOptions
    ): void {
        if (!this.config.enabled) {
            return;
        }

        const metadata = this.buildMetadata();
        const event = {
            name: eventName,
            properties: properties as Record<string, any>,
            metadata,
            options
        };

        this.log(`Tracking event: ${eventName}`, properties);

        // Send to all adapters
        for (const adapter of this.adapters) {
            try {
                adapter.track(event);
            } catch (error) {
                console.error(`Adapter ${adapter.name} failed to track event:`, error);
            }
        }
    }

    /**
     * Track a custom event (for events not in GameEventMap)
     * Use this for one-off tracking or experimental events
     */
    trackCustom(
        eventName: string,
        properties: Record<string, any>,
        options?: EventOptions
    ): void {
        if (!this.config.enabled) {
            return;
        }

        const metadata = this.buildMetadata();
        const event = {
            name: eventName,
            properties,
            metadata,
            options
        };

        this.log(`Tracking custom event: ${eventName}`, properties);

        for (const adapter of this.adapters) {
            try {
                adapter.track(event);
            } catch (error) {
                console.error(`Adapter ${adapter.name} failed to track custom event:`, error);
            }
        }
    }

    // ========================================================================
    // Session Management
    // ========================================================================

    getSessionId(): string {
        return this.sessionId;
    }

    getSessionDuration(): number {
        return (Date.now() - this.sessionStartTime) / 1000; // seconds
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Flush all pending events immediately
     */
    flush(): void {
        this.log('Flushing all adapters');
        for (const adapter of this.adapters) {
            try {
                adapter.flush();
            } catch (error) {
                console.error(`Adapter ${adapter.name} failed to flush:`, error);
            }
        }
    }

    /**
     * Shutdown analytics service and cleanup
     */
    shutdown(): void {
        this.log('Shutting down AnalyticsService');
        for (const adapter of this.adapters) {
            try {
                adapter.shutdown();
            } catch (error) {
                console.error(`Adapter ${adapter.name} failed to shutdown:`, error);
            }
        }
        AnalyticsService.instance = null;
    }

    /**
     * Enable/disable analytics at runtime
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        this.log(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
    }

    isEnabled(): boolean {
        return this.config.enabled;
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private buildMetadata(): EventMetadata {
        const metadata: EventMetadata = {
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        if (this.config.includeSessionMetadata) {
            metadata.sessionDuration = this.getSessionDuration();
            metadata.userAgent = navigator.userAgent;
            metadata.platform = this.detectPlatform();
        }

        return metadata;
    }

    private detectPlatform(): 'desktop' | 'mobile' | 'vr' {
        // Check if in VR session
        if (navigator.xr) {
            return 'vr';
        }

        // Check mobile
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /mobile|android|iphone|ipad|tablet/.test(userAgent);
        return isMobile ? 'mobile' : 'desktop';
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private log(message: string, ...args: any[]): void {
        if (this.config.debug) {
            console.log(`[AnalyticsService] ${message}`, ...args);
        }
    }
}

// ============================================================================
// Convenience Export
// ============================================================================

/**
 * Get the analytics service instance
 * Throws if not initialized
 */
export function getAnalytics(): AnalyticsService {
    return AnalyticsService.getInstance();
}
