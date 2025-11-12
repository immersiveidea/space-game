# Analytics System

A flexible, provider-agnostic analytics system with intelligent batching for the Space Game.

## Overview

The analytics system provides:
- **Type-safe event tracking** with TypeScript interfaces
- **Pluggable adapters** for different analytics providers (New Relic, GA4, PostHog, etc.)
- **Intelligent batching** to reduce data usage by ~70%
- **Sampling support** for high-volume events
- **Zero breaking changes** to existing New Relic setup

## Architecture

```
AnalyticsService (Singleton)
    ↓
AnalyticsAdapter Interface
    ↓
├─ NewRelicAdapter (with batching)
├─ GA4Adapter (future)
└─ PostHogAdapter (future)
```

## Quick Start

### Tracking Events

```typescript
import { getAnalytics } from './analytics';

// Type-safe event tracking
const analytics = getAnalytics();

analytics.track('level_start', {
    levelName: 'level_1',
    difficulty: 'captain',
    playCount: 1
});

// High-volume events with sampling
analytics.track('asteroid_destroyed', {
    weaponType: 'laser',
    distance: 150,
    asteroidSize: 5,
    remainingCount: 45
}, { sampleRate: 0.2 }); // Only track 20% of events

// Critical events sent immediately
analytics.track('javascript_error', {
    errorMessage: 'Failed to load asset',
    errorStack: error.stack,
    componentName: 'Ship',
    isCritical: true
}, { immediate: true }); // Skip batching
```

### Custom Events

For events not in `GameEventMap`:

```typescript
analytics.trackCustom('experimental_feature_used', {
    featureName: 'new_weapon',
    timestamp: Date.now()
});
```

## Event Types

All event types are defined in `events/gameEvents.ts`:

### Session Events
- `session_start` - Initial page load
- `session_end` - User closes/leaves game
- `webxr_session_start` - Enters VR mode
- `webxr_session_end` - Exits VR mode

### Level Events
- `level_start` - Level begins
- `level_complete` - Level successfully completed
- `level_failed` - Player died/failed

### Gameplay Events
- `asteroid_destroyed` - Asteroid hit by weapon
- `shot_fired` - Weapon fired
- `hull_damage` - Ship takes damage
- `ship_collision` - Ship collides with object

### Performance Events
- `performance_snapshot` - Periodic FPS/render stats
- `asset_loading` - Asset load time tracking

### Error Events
- `javascript_error` - JS errors/exceptions
- `webxr_error` - WebXR-specific errors

## Batching System

The New Relic adapter automatically batches events to reduce data usage:

### How Batching Works

1. Events are queued in memory
2. Queue flushes when:
   - **10 events** accumulated (configurable)
   - **30 seconds** elapsed (configurable)
   - Page is closing (`beforeunload`)
   - Tab becomes hidden (`visibilitychange`)

3. Similar events are grouped and aggregated:
   ```javascript
   // Instead of 10 separate events:
   asteroid_destroyed × 10 (10 KB)

   // Send 1 batched event:
   asteroid_destroyed_batch {
       eventCount: 10,
       aggregates: {
           distance_min: 50,
           distance_max: 200,
           distance_avg: 125
       }
   } (2 KB)
   ```

### Cost Savings

**Without batching:**
- 100 events × 1 KB = 100 KB per session
- 1,000 users/day = 100 MB/day = 3 GB/month

**With batching:**
- 100 events → 15 batched events × 2 KB = 30 KB per session
- 1,000 users/day = 30 MB/day = 0.9 GB/month

**Savings: 70% reduction in data usage**

## Configuration

### Adapter Configuration

```typescript
// In main.ts
const newRelicAdapter = new NewRelicAdapter(nrba, {
    batchSize: 10,        // Flush after N events
    flushInterval: 30000, // Flush after N milliseconds
    debug: false          // Enable console logging
});
```

### Service Configuration

```typescript
const analytics = AnalyticsService.initialize({
    enabled: true,                    // Enable/disable globally
    includeSessionMetadata: true,     // Add session info to events
    debug: false,                     // Enable console logging
    sessionId: 'custom-session-id'    // Optional custom session ID
});
```

## Current Integration Points

### 1. Main Entry Point (`main.ts`)
- Session start tracking
- Analytics service initialization
- New Relic adapter setup

### 2. Ship Class (`ship/ship.ts`)
- Asteroid destruction events (20% sampled)
- Hull damage events

### 3. Level1 Class (`levels/level1.ts`)
- Level start events
- WebXR session start events

### 4. GameStats Class (`game/gameStats.ts`)
- Performance snapshots every 60 seconds (50% sampled)
- Session end summaries

## Adding a New Adapter

To add support for Google Analytics 4:

```typescript
// 1. Create adapters/ga4Adapter.ts
export class GA4Adapter implements AnalyticsAdapter {
    readonly name = 'ga4';

    initialize() {
        // Initialize gtag
    }

    track(event: AnalyticsEvent) {
        gtag('event', event.name, event.properties);
    }

    flush() {
        // GA4 auto-flushes
    }

    shutdown() {
        // Cleanup
    }
}

// 2. Register in main.ts
const ga4Adapter = new GA4Adapter();
analytics.addAdapter(ga4Adapter);
```

Now all events will be sent to **both** New Relic and GA4!

## Sampling Strategy

Use sampling to reduce costs for high-frequency events:

```typescript
// Low frequency, critical - track 100%
analytics.track('level_complete', {...});

// Medium frequency - track 50%
analytics.track('hull_damage', {...}, { sampleRate: 0.5 });

// High frequency - track 20%
analytics.track('asteroid_destroyed', {...}, { sampleRate: 0.2 });

// Very high frequency - track 10%
analytics.track('shot_fired', {...}, { sampleRate: 0.1 });
```

## Cost Monitoring

### New Relic Free Tier
- **100 GB/month** data ingest
- Current usage estimate: **~2-5 GB/month** at 1,000 DAU
- Batching + sampling keeps you safely under limits

### Checking Usage
1. Go to New Relic account settings
2. Navigate to **Usage → Data Ingest**
3. Monitor monthly consumption

### Budget Alerts
Set up alerts in New Relic:
- Alert at **50 GB** (50% threshold)
- Alert at **80 GB** (80% threshold)

## Debugging

### Enable Debug Mode

```typescript
// In main.ts
const analytics = AnalyticsService.initialize({
    debug: true // Log all events to console
});

const newRelicAdapter = new NewRelicAdapter(nrba, {
    debug: true // Log batching operations
});
```

### Test Events

```typescript
// Open browser console
const analytics = getAnalytics();

// Send test event
analytics.track('level_start', {
    levelName: 'test',
    difficulty: 'recruit',
    playCount: 1
});

// Force flush
analytics.flush();
```

### Verify in New Relic

1. Go to New Relic dashboard
2. Navigate to **Browser → PageActions**
3. Search for event names (e.g., `level_start`)
4. View event properties and batched aggregates

## Performance Impact

The analytics system is designed for **zero gameplay impact**:

- Events are queued asynchronously
- Batching reduces network requests by 70%
- Try/catch blocks prevent errors from breaking gameplay
- Network failures are silently handled

## Future Enhancements

- [ ] Add GA4 adapter for product analytics
- [ ] Track weapon-specific metrics (weapon type in events)
- [ ] Calculate asteroid distance in collision events
- [ ] Integrate with ProgressionManager for play counts
- [ ] Add real-time FPS tracking to performance snapshots
- [ ] Track controller input patterns (VR usability)
- [ ] Implement user cohort analysis
- [ ] Add A/B testing support for difficulty tuning

## Best Practices

1. **Use typed events** from `GameEventMap` whenever possible
2. **Sample high-frequency events** to control costs
3. **Mark critical events as immediate** to ensure delivery
4. **Wrap analytics calls in try/catch** to prevent gameplay breakage
5. **Monitor New Relic data usage** monthly
6. **Test with debug mode enabled** during development

## License

Part of the Space Game project.
