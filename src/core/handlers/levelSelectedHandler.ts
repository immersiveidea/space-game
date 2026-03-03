import { AbstractEngine, AudioEngineV2, ParticleHelper } from "@babylonjs/core";
import { DefaultScene } from "../defaultScene";
import { Level1 } from "../../levels/level1";
import Level from "../../levels/level";
import { RockFactory } from "../../environment/asteroids/rockFactory";
import { LevelConfig } from "../../levels/config/levelConfig";
import { Preloader } from "../../ui/screens/preloader";
import { LevelRegistry } from "../../levels/storage/levelRegistry";
import { enterXRMode } from "./xrEntryHandler";
import { prefetchAsset } from "../../utils/loadAsset";
import { prefetchAllAudio } from "../../utils/audioPrefetch";
import log from '../logger';

export interface LevelSelectedContext {
    isStarted(): boolean;
    setStarted(value: boolean): void;
    isInitialized(): boolean;
    areAssetsLoaded(): boolean;
    setAssetsLoaded(value: boolean): void;
    initializeEngine(): Promise<void>;
    initializeXR(): Promise<void>;
    getAudioEngine(): AudioEngineV2;
    getEngine(): AbstractEngine;
    setCurrentLevel(level: Level): void;
    setProgressCallback(callback: (percent: number, message: string) => void): void;
    play(): Promise<void>;
}

export function createLevelSelectedHandler(
    context: LevelSelectedContext
): (e: CustomEvent) => Promise<void> {
    return async (e: CustomEvent) => {
        context.setStarted(true);
        const { levelName, config } = e.detail as { levelName: string; config: LevelConfig };
        log.debug(`[Main] Starting level: ${levelName}`);

        hideUIElements();
        const preloader = new Preloader();
        context.setProgressCallback((p, m) => preloader.updateProgress(p, m));

        try {
            // Phase 1: Load engine and prefetch assets
            await loadEngineAndAssets(context, preloader);
            await context.initializeXR();

            // Phase 2: Create level and add meshes (hidden)
            const level = await setupLevel(context, config, levelName, preloader);

            displayLevelInfo(preloader, levelName);
            preloader.updateProgress(90, 'Ready to enter VR...');

            const xrAvailable = await preloader.checkXRAvailability();
            if (!xrAvailable) {
                preloader.showVRNotAvailable();
                return;
            }

            // Phase 3: Enter XR, initialize physics, audio
            preloader.showStartButton(async () => {
                await startGameWithXR(context, level, preloader);
            });
        } catch (error) {
            log.error('[Main] Level initialization failed:', error);
            preloader.updateProgress(0, 'Failed to load level. Please refresh.');
        }
    };
}

function hideUIElements(): void {
    const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
    const appHeader = document.querySelector('#appHeader') as HTMLElement;
    if (levelSelect) levelSelect.style.display = 'none';
    if (appHeader) appHeader.style.display = 'none';
}

async function loadEngineAndAssets(context: LevelSelectedContext, preloader: Preloader): Promise<void> {
    if (!context.isInitialized()) {
        preloader.updateProgress(0, 'Initializing game engine...');
        await context.initializeEngine();
    }
    if (!context.areAssetsLoaded()) {
        preloader.updateProgress(20, 'Loading assets...');
        ParticleHelper.BaseAssetsUrl = window.location.href;

        // Phase 1: Prefetch all GLBs and audio in parallel
        await Promise.all([
            prefetchAsset("ship.glb"),
            prefetchAsset("asteroid.glb"),
            prefetchAsset("base.glb"),
            prefetchAllAudio()
        ]);

        context.setAssetsLoaded(true);
        preloader.updateProgress(50, 'Assets loaded');
    }
}

/**
 * Phase 2: Create level and add meshes to scene (hidden)
 */
async function setupLevel(
    context: LevelSelectedContext,
    config: LevelConfig,
    levelName: string,
    preloader: Preloader
): Promise<Level1> {
    preloader.updateProgress(55, 'Creating level...');

    const level = new Level1(config, undefined, false, levelName);
    context.setCurrentLevel(level);

    // Add meshes to scene (hidden - will show after XR entry)
    await level.addToScene(true);

    preloader.updateProgress(80, 'Level ready');
    return level;
}

function displayLevelInfo(preloader: Preloader, levelName: string): void {
    const entry = LevelRegistry.getInstance().getLevelEntry(levelName);
    if (entry) {
        preloader.setLevelInfo(entry.name, entry.difficulty, entry.missionBrief || []);
    }
}

/**
 * Phase 3: Enter XR, initialize physics, show meshes, initialize audio
 */
async function startGameWithXR(
    context: LevelSelectedContext,
    level: Level1,
    preloader: Preloader
): Promise<void> {
    const engine = context.getEngine();
    const config = (level as any)._levelConfig;

    preloader.updateProgress(92, 'Entering VR...');

    // Enter XR mode
    await enterXRMode(config, engine);

    // Initialize physics (Phase 3)
    preloader.updateProgress(94, 'Initializing physics...');
    level.initializePhysics();

    // Show meshes now that XR is active
    level.showMeshes();

    // Initialize audio after XR entry
    const audioEngine = context.getAudioEngine();
    await audioEngine?.unlockAsync();
    preloader.updateProgress(97, 'Loading audio...');
    await Promise.all([
        RockFactory.initAudio(audioEngine),
        level.initializeAudio(audioEngine)
    ]);
    attachAudioListener(audioEngine);

    // Finalize
    await finalizeLevelStart(level, engine, preloader, context);
}

function attachAudioListener(audioEngine: AudioEngineV2): void {
    const camera = DefaultScene.XR?.baseExperience?.camera || DefaultScene.MainScene.activeCamera;
    if (camera && audioEngine?.listener) {
        audioEngine.listener.attach(camera);
    }
}

async function finalizeLevelStart(
    level: Level1,
    engine: AbstractEngine,
    preloader: Preloader,
    context: LevelSelectedContext
): Promise<void> {
    const ship = (level as any)._ship;
    ship?.onReplayRequestObservable.add(() => window.location.reload());

    if (DefaultScene.XR && DefaultScene.XR.baseExperience.state === 2) {
        level.setupXRCamera();
        await level.showMissionBrief();
    } else {
        showCanvasForFlatMode(engine);
    }

    preloader.updateProgress(100, 'Ready!');
    preloader.hide();
    await context.play();
}

function showCanvasForFlatMode(engine: AbstractEngine): void {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.style.display = 'block';
    engine.stopRenderLoop();
    engine.runRenderLoop(() => DefaultScene.MainScene.render());
}
