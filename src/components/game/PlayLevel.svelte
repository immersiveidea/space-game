<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { navigate } from 'svelte-routing';
    import { Main } from '../../main';
    import type { LevelConfig } from '../../levels/config/levelConfig';
    import { LevelRegistry } from '../../levels/storage/levelRegistry';
    import { CloudLevelService } from '../../services/cloudLevelService';
    import { progressionStore } from '../../stores/progression';
    import log from '../../core/logger';
    import { DefaultScene } from '../../core/defaultScene';

    // svelte-routing passes params as an object with route params
    export let params: { levelId?: string } = {};
    // Also accept levelId directly in case it's passed that way
    export let levelId: string = '';

    let mainInstance: Main | null = null;
    let levelName: string = '';
    let isInitialized = false;
    let error: string | null = null;
    let isExiting = false;

    // Get the actual levelId from either source
    $: actualLevelId = params?.levelId || levelId || '';

    // Handle browser back button
    function handleBeforeUnload(event: BeforeUnloadEvent) {
        // Only prompt if in XR session
        if (DefaultScene.XR && DefaultScene.XR.baseExperience.state === 2) {
            event.preventDefault();
            event.returnValue = 'You are currently in VR. Are you sure you want to exit?';
            return event.returnValue;
        }
    }

    // Handle popstate (browser back/forward buttons)
    function handlePopState() {
        if (isInitialized && !isExiting && !window.location.pathname.startsWith('/play/')) {
            log.debug('[PlayLevel] Navigation detected via popstate, starting cleanup');
            isExiting = true;
        }
    }

    onMount(async () => {
        log.info('[PlayLevel] Component mounted');
        log.info('[PlayLevel] params:', params);
        log.info('[PlayLevel] levelId prop:', levelId);
        log.info('[PlayLevel] actualLevelId:', actualLevelId);
        log.info('[PlayLevel] window.location.pathname:', window.location.pathname);

        // Try to extract levelId from URL if props don't have it
        let extractedLevelId = actualLevelId;
        if (!extractedLevelId) {
            const match = window.location.pathname.match(/\/play\/(.+)/);
            if (match) {
                extractedLevelId = match[1];
                log.info('[PlayLevel] Extracted levelId from URL:', extractedLevelId);
            }
        }

        levelName = extractedLevelId;

        if (!levelName) {
            log.error('[PlayLevel] No levelId found!');
            error = 'No level specified';
            return;
        }

        log.info('[PlayLevel] Using levelName:', levelName);

        // Add event listeners
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('popstate', handlePopState);

        try {
            // Hide the Svelte UI overlay (keep in DOM for reactivity)
            const appElement = document.getElementById('app');
            if (appElement) {
                appElement.style.display = 'none';
                log.debug('[PlayLevel] App UI hidden');
            }

            // Get the main instance (should already exist from app initialization)
            mainInstance = (window as any).__mainInstance as Main;

            if (!mainInstance) {
                throw new Error('Main instance not found');
            }

            // Get full level entry from registry first
            const registry = LevelRegistry.getInstance();
            let levelEntry = registry.getLevelEntry(levelName);

            // If not in registry, try fetching by ID (for private/custom levels)
            if (!levelEntry) {
                log.info('[PlayLevel] Level not in registry, fetching from cloud:', levelName);
                levelEntry = await CloudLevelService.getInstance().getLevelById(levelName);
            }

            if (!levelEntry) {
                throw new Error(`Level "${levelName}" not found`);
            }

            // Check if level is unlocked (skip for private levels)
            const isOfficial = levelEntry.levelType === 'official';
            if (isOfficial && !progressionStore.isLevelUnlocked(levelEntry.name, true)) {
                log.warn('[PlayLevel] Level locked, redirecting to level select');
                navigate('/', { replace: true });
                return;
            }

            log.debug('[PlayLevel] Level config loaded:', levelEntry);

            // Dispatch the levelSelected event
            const event = new CustomEvent('levelSelected', {
                detail: {
                    levelName: levelName,
                    config: levelEntry.config
                }
            });
            window.dispatchEvent(event);

            isInitialized = true;
            log.debug('[PlayLevel] Level initialization started');

        } catch (err) {
            log.error('[PlayLevel] Error initializing level:', err);
            error = err instanceof Error ? err.message : 'Unknown error';

            // Show UI again on error
            const appElement = document.getElementById('app');
            if (appElement) {
                appElement.style.display = 'block';
            }

            // Navigate back to home after showing error
            setTimeout(() => {
                navigate('/', { replace: true });
            }, 3000);
        }
    });

    onDestroy(async () => {
        log.info('[PlayLevel] Component unmounting - cleaning up');
        log.debug('[PlayLevel] Component unmounting - cleaning up');

        // Remove event listeners
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);

        // Ensure UI is visible again FIRST (before any async operations)
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.style.display = 'block';
            log.info('[PlayLevel] App UI restored');
            log.debug('[PlayLevel] App UI restored');
        }

        try {
            // Call the cleanup method on Main instance
            if (mainInstance && typeof mainInstance.cleanupAndExit === 'function') {
                await mainInstance.cleanupAndExit();
            }
        } catch (err) {
            log.error('[PlayLevel] Error during cleanup:', err);
        }
    });
</script>

<!-- Minimal template - BabylonJS canvas is fixed background -->
<div class="play-level-container">
    {#if error}
        <div class="error-overlay">
            <h2>Error Loading Level</h2>
            <p>{error}</p>
            <p>Returning to level select...</p>
        </div>
    {/if}
</div>

<style>
    .play-level-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
    }

    .error-overlay {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 2rem;
        border-radius: 10px;
        color: white;
        text-align: center;
        z-index: 1000;
        pointer-events: auto;
    }

    .error-overlay h2 {
        color: #ff4444;
        margin-bottom: 1rem;
    }

    .error-overlay p {
        margin: 0.5rem 0;
    }
</style>
