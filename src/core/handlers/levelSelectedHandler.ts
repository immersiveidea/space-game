import { AudioEngineV2, Engine, ParticleHelper } from "@babylonjs/core";
import { DefaultScene } from "../defaultScene";
import { Level1 } from "../../levels/level1";
import Level from "../../levels/level";
import { RockFactory } from "../../environment/asteroids/rockFactory";
import { LevelConfig } from "../../levels/config/levelConfig";
import { Preloader } from "../../ui/screens/preloader";
import log from '../logger';

/**
 * Interface for Main class methods needed by the level selected handler
 */
export interface LevelSelectedContext {
    isStarted(): boolean;
    setStarted(value: boolean): void;
    isInitialized(): boolean;
    areAssetsLoaded(): boolean;
    setAssetsLoaded(value: boolean): void;
    initializeEngine(): Promise<void>;
    initializeXR(): Promise<void>;
    getAudioEngine(): AudioEngineV2;
    getEngine(): Engine;
    setCurrentLevel(level: Level): void;
    setProgressCallback(callback: (percent: number, message: string) => void): void;
    play(): Promise<void>;
}

/**
 * Creates the levelSelected event handler
 * @param context - Main instance implementing LevelSelectedContext
 * @returns Event handler function
 */
export function createLevelSelectedHandler(context: LevelSelectedContext): (e: CustomEvent) => Promise<void> {
    return async (e: CustomEvent) => {
        context.setStarted(true);
        const { levelName, config } = e.detail as { levelName: string, config: LevelConfig };

        log.debug(`[Main] Starting level: ${levelName}`);

        // Hide all UI elements
        const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
        const appHeader = document.querySelector('#appHeader') as HTMLElement;

        if (levelSelect) {
            levelSelect.style.display = 'none';
        }
        if (appHeader) {
            appHeader.style.display = 'none';
        }

        // Show preloader for initialization
        const preloader = new Preloader();
        context.setProgressCallback((percent, message) => {
            preloader.updateProgress(percent, message);
        });

        try {
            // Initialize engine if this is first time
            if (!context.isInitialized()) {
                log.debug('[Main] First level selected - initializing engine');
                preloader.updateProgress(0, 'Initializing game engine...');
                await context.initializeEngine();
            }

            // Load assets if this is the first level being played
            if (!context.areAssetsLoaded()) {
                preloader.updateProgress(40, 'Loading 3D models and textures...');
                log.debug('[Main] Loading assets for first time');

                // Load visual assets (meshes, particles)
                ParticleHelper.BaseAssetsUrl = window.location.href;
                await RockFactory.init();
                context.setAssetsLoaded(true);

                log.debug('[Main] Assets loaded successfully');
                preloader.updateProgress(60, 'Assets loaded');
            }

            preloader.updateProgress(70, 'Preparing VR session...');

            // Initialize WebXR for this level
            await context.initializeXR();

            // If XR is available, enter XR immediately (while we have user activation)
            let xrSession = null;
            const engine = context.getEngine();
            if (DefaultScene.XR) {
                try {
                    preloader.updateProgress(75, 'Entering VR...');
                    xrSession = await DefaultScene.XR.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
                    log.debug('XR session started successfully (render loop paused until camera is ready)');
                } catch (error) {
                    log.debug('Failed to enter XR, will fall back to flat mode:', error);
                    DefaultScene.XR = null;
                    // Show canvas for flat mode
                    const canvas = document.getElementById('gameCanvas');
                    if (canvas) {
                        canvas.style.display = 'block';
                    }
                    engine.runRenderLoop(() => {
                        DefaultScene.MainScene.render();
                    });
                }
            }

            // Unlock audio engine on user interaction
            const audioEngine = context.getAudioEngine();
            if (audioEngine) {
                await audioEngine.unlockAsync();
            }

            // Now load audio assets (after unlock)
            preloader.updateProgress(80, 'Loading audio...');
            await RockFactory.initAudio(audioEngine);

            // Attach audio listener to camera for spatial audio
            const camera = DefaultScene.XR?.baseExperience?.camera || DefaultScene.MainScene.activeCamera;
            if (camera && audioEngine.listener) {
                audioEngine.listener.attach(camera);
                log.debug('[Main] Audio listener attached to camera for spatial audio');
            } else {
                log.warn('[Main] Could not attach audio listener - camera or listener not available');
            }

            preloader.updateProgress(90, 'Creating level...');

            // Create and initialize level from config
            const currentLevel = new Level1(config, audioEngine, false, levelName);
            context.setCurrentLevel(currentLevel);

            // Wait for level to be ready
            currentLevel.getReadyObservable().add(async () => {
                preloader.updateProgress(95, 'Starting game...');

                // Get ship and set up replay observable
                const level1 = currentLevel as Level1;
                const ship = (level1 as any)._ship;

                // Listen for replay requests from the ship
                if (ship) {
                    ship.onReplayRequestObservable.add(() => {
                        log.debug('Replay requested - reloading page');
                        window.location.reload();
                    });
                }

                // If we entered XR before level creation, manually setup camera parenting
                log.info('[Main] ========== CHECKING XR STATE ==========');
                log.info('[Main] DefaultScene.XR exists:', !!DefaultScene.XR);
                log.info('[Main] xrSession exists:', !!xrSession);
                if (DefaultScene.XR) {
                    log.info('[Main] XR base experience state:', DefaultScene.XR.baseExperience.state);
                }

                if (DefaultScene.XR && xrSession && DefaultScene.XR.baseExperience.state === 2) {
                    log.debug('[Main] XR already active - using consolidated setupXRCamera()');
                    level1.setupXRCamera();
                    await level1.showMissionBrief();
                    log.debug('[Main] XR setup and mission brief complete');
                } else {
                    log.info('[Main] XR not active yet - will use onInitialXRPoseSetObservable instead');
                    // Show canvas for non-XR mode
                    const canvas = document.getElementById('gameCanvas');
                    if (canvas) {
                        canvas.style.display = 'block';
                    }
                    engine.runRenderLoop(() => {
                        DefaultScene.MainScene.render();
                    });
                }

                // Hide preloader
                preloader.updateProgress(100, 'Ready!');
                setTimeout(() => {
                    preloader.hide();
                }, 500);

                // Hide UI (no longer remove from DOM - let Svelte routing handle it)
                log.info('[Main] ========== HIDING UI FOR GAMEPLAY ==========');
                log.info('[Main] Timestamp:', Date.now());

                // Start the game
                log.info('[Main] About to call context.play()');
                await context.play();
                log.info('[Main] context.play() completed');
            });

            // Now initialize the level (after observable is registered)
            await currentLevel.initialize();

        } catch (error) {
            log.error('[Main] Level initialization failed:', error);
            preloader.updateProgress(0, 'Failed to load level. Please refresh and try again.');
        }
    };
}
