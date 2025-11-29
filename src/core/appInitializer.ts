import { mount } from 'svelte';
import App from '../components/layouts/App.svelte';
import { LegacyMigration } from '../levels/migration/legacyMigration';
import { LevelRegistry } from '../levels/storage/levelRegistry';
import log from './logger';

// Type for Main class - imported dynamically to avoid circular dependency
type MainClass = new (progressCallback?: (percent: number, message: string) => void) => any;

/**
 * Initialize the application
 */
export async function initializeApp(MainConstructor: MainClass): Promise<void> {
    log.info('[Main] ========================================');
    log.info('[Main] initializeApp() STARTED at', new Date().toISOString());
    log.info('[Main] ========================================');

    const needsMigration = LegacyMigration.needsMigration();
    log.info('[Main] Needs migration check:', needsMigration);

    if (needsMigration) {
        log.debug('[Main] Legacy data detected - showing migration modal');
        return new Promise<void>((resolve) => {
            LegacyMigration.showMigrationModal(async (result) => {
                log.debug('[Main] Migration completed:', result);
                try {
                    log.info('[Main] Initializing LevelRegistry [AFTER MIGRATION]');
                    await LevelRegistry.getInstance().initialize();
                    log.info('[Main] LevelRegistry initialized [AFTER MIGRATION]');
                    mountAppAndCreateMain(MainConstructor);
                    resolve();
                } catch (error) {
                    log.error('[Main] Failed to initialize LevelRegistry after migration:', error);
                    resolve();
                }
            });
        });
    }

    log.info('[Main] No migration needed - proceeding to initialize registry');
    try {
        log.info('[Main] Initializing LevelRegistry');
        await LevelRegistry.getInstance().initialize();
        log.info('[Main] LevelRegistry initialized successfully');

        // Expose registry to window for debugging (dev mode)
        const isDev = window.location.hostname === 'localhost' ||
                      window.location.hostname.includes('dev.') ||
                      window.location.port !== '';
        if (isDev) {
            (window as any).__levelRegistry = LevelRegistry.getInstance();
            log.info('[Main] LevelRegistry exposed to window.__levelRegistry');
        }
    } catch (error) {
        log.error('[Main] Failed to initialize LevelRegistry:', error);
    }

    mountAppAndCreateMain(MainConstructor);
    log.info('[Main] initializeApp() FINISHED');
}

/**
 * Mount the Svelte app and create Main instance
 */
function mountAppAndCreateMain(MainConstructor: MainClass): void {
    log.info('[Main] Mounting Svelte app');
    const appElement = document.getElementById('app');
    if (appElement) {
        mount(App, { target: appElement });
        log.info('[Main] Svelte app mounted successfully');

        if (!(window as any).__mainInstance) {
            log.debug('[Main] Creating Main instance');
            const main = new MainConstructor();
            (window as any).__mainInstance = main;
        }
    } else {
        log.error('[Main] Failed to mount Svelte app - #app element not found');
    }
}

/**
 * Set up global error handler for shader loading errors
 */
export function setupErrorHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason;
        if (error?.message) {
            if (error.message.includes('rgbdDecode.fragment') ||
                error.message.includes('procedural.vertex') ||
                (error.message.includes('Failed to fetch dynamically imported module') &&
                 (error.message.includes('rgbdDecode') || error.message.includes('procedural')))) {
                log.debug('[Main] Suppressed shader loading error:', error.message);
                event.preventDefault();
            }
        }
    });
}
