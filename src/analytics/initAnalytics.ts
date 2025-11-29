import { BrowserAgent } from '@newrelic/browser-agent/loaders/browser-agent';
import { AnalyticsService } from './analyticsService';
import { NewRelicAdapter } from './adapters/newRelicAdapter';

// New Relic configuration
const options = {
    init: {
        distributed_tracing: { enabled: true },
        performance: { capture_measures: true },
        browser_consent_mode: { enabled: false },
        privacy: { cookies_enabled: true },
        ajax: { deny_list: ["bam.nr-data.net"] }
    },
    loader_config: {
        accountID: "7354964",
        trustKey: "7354964",
        agentID: "601599788",
        licenseKey: "NRJS-5673c7fa13b17021446",
        applicationID: "601599788"
    },
    info: {
        beacon: "bam.nr-data.net",
        errorBeacon: "bam.nr-data.net",
        licenseKey: "NRJS-5673c7fa13b17021446",
        applicationID: "601599788",
        sa: 1
    }
};

/**
 * Initialize analytics with New Relic adapter
 * @returns The configured AnalyticsService instance
 */
export function initializeAnalytics(): AnalyticsService {
    const nrba = new BrowserAgent(options);

    const analytics = AnalyticsService.initialize({
        enabled: true,
        includeSessionMetadata: true,
        debug: true
    });

    const newRelicAdapter = new NewRelicAdapter(nrba, {
        batchSize: 10,
        flushInterval: 30000,
        debug: true
    });

    analytics.addAdapter(newRelicAdapter);

    // Track initial session start
    analytics.track('session_start', {
        platform: navigator.xr ? 'vr' : (/mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'),
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height
    });

    return analytics;
}
