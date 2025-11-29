import { mount } from 'svelte';
import App from '../components/layouts/App.svelte';
import { LegacyMigration } from '../levels/migration/legacyMigration';
import { LevelRegistry } from '../levels/storage/levelRegistry';
import debugLog from './debug';

// Type for Main class - imported dynamically to avoid circular dependency
type MainClass = new (progressCallback?: (percent: number, message: string) => void) => any;

/**
 * Initialize the application
 * - Check for legacy data migration
 * - Initialize level registry
 * - Mount Svelte app
 * - Create Main instance
 */
export async function initializeApp(MainConstructor: MainClass): Promise<void> {
    console.log('[Main] ========================================');
    console.log('[Main] initializeApp() STARTED at', new Date().toISOString());
    console.log('[Main] ========================================');

    // Check for legacy data migration
    const needsMigration = LegacyMigration.needsMigration();
    console.log('[Main] Needs migration check:', needsMigration);

    if (needsMigration) {
        debugLog('[Main] Legacy data detected - showing migration modal');
        return new Promise<void>((resolve) => {
            LegacyMigration.showMigrationModal(async (result) => {
                debugLog('[Main] Migration completed:', result);
                // Initialize the new registry system
                try {
                    console.log('[Main] About to call LevelRegistry.getInstance().initialize() [AFTER MIGRATION]');
                    await LevelRegistry.getInstance().initialize();
                    console.log('[Main] LevelRegistry.initialize() completed successfully [AFTER MIGRATION]');
                    debugLog('[Main] LevelRegistry initialized after migration');

                    // Mount Svelte app and create Main
                    mountAppAndCreateMain(MainConstructor);
                    resolve();
                } catch (error) {
                    console.error('[Main] Failed to initialize LevelRegistry after migration:', error);
                    resolve();
                }
            });
        });
    } else {
        console.log('[Main] No migration needed - proceeding to initialize registry');
        // Initialize the new registry system
        try {
            console.log('[Main] About to call LevelRegistry.getInstance().initialize()');
            console.log('[Main] Timestamp before initialize:', Date.now());
            await LevelRegistry.getInstance().initialize();
            console.log('[Main] Timestamp after initialize:', Date.now());
            console.log('[Main] LevelRegistry.initialize() completed successfully');
            debugLog('[Main] LevelRegistry initialized');

            // Expose registry to window for debugging (dev mode)
            const isDev = window.location.hostname === 'localhost' ||
                          window.location.hostname.includes('dev.') ||
                          window.location.port !== '';
            if (isDev) {
                (window as any).__levelRegistry = LevelRegistry.getInstance();
                console.log('[Main] LevelRegistry exposed to window.__levelRegistry for debugging');
                console.log('[Main] To clear caches: window.__levelRegistry.reset(); location.reload()');
            }
        } catch (error) {
            console.error('[Main] !!!!! EXCEPTION in LevelRegistry initialization !!!!!');
            console.error('[Main] Failed to initialize LevelRegistry:', error);
            console.error('[Main] Error stack:', (error as Error)?.stack);
        }
    }

    // Mount Svelte app and create Main
    mountAppAndCreateMain(MainConstructor);

    console.log('[Main] initializeApp() FINISHED at', new Date().toISOString());
}

/**
 * Mount the Svelte app and create Main instance
 */
function mountAppAndCreateMain(MainConstructor: MainClass): void {
    console.log('[Main] Mounting Svelte app');
    const appElement = document.getElementById('app');
    if (appElement) {
        mount(App, {
            target: appElement
        });
        console.log('[Main] Svelte app mounted successfully');

        // Create Main instance lazily only if it doesn't exist
        if (!(window as any).__mainInstance) {
            debugLog('[Main] Creating Main instance (not initialized)');
            const main = new MainConstructor();
            (window as any).__mainInstance = main;
        }
    } else {
        console.error('[Main] Failed to mount Svelte app - #app element not found');
    }
}

/**
 * Set up global error handler for shader loading errors
 * Suppress non-critical BabylonJS shader loading errors during development
 */
export function setupErrorHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason;
        if (error && error.message) {
            // Only suppress specific shader-related errors, not asset loading errors
            if (error.message.includes('rgbdDecode.fragment') ||
                error.message.includes('procedural.vertex') ||
                (error.message.includes('Failed to fetch dynamically imported module') &&
                 (error.message.includes('rgbdDecode') || error.message.includes('procedural')))) {
                debugLog('[Main] Suppressed shader loading error (should be fixed by Vite pre-bundling):', error.message);
                event.preventDefault();
            }
        }
    });
}
