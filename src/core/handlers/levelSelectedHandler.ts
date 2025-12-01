import { AudioEngineV2, Engine, ParticleHelper } from "@babylonjs/core";
import { DefaultScene } from "../defaultScene";
import { Level1 } from "../../levels/level1";
import Level from "../../levels/level";
import { RockFactory } from "../../environment/asteroids/rockFactory";
import { LevelConfig } from "../../levels/config/levelConfig";
import { Preloader } from "../../ui/screens/preloader";
import { LevelRegistry } from "../../levels/storage/levelRegistry";
import { enterXRMode } from "./xrEntryHandler";
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
    getEngine(): Engine;
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
            await loadEngineAndAssets(context, preloader);
            await context.initializeXR();
            displayLevelInfo(preloader, levelName);
            preloader.updateProgress(90, 'Ready to enter VR...');

            const xrAvailable = await preloader.checkXRAvailability();
            if (!xrAvailable) {
                preloader.showVRNotAvailable();
                return;
            }

            preloader.showStartButton(async () => {
                await startGameWithXR(context, config, levelName, preloader);
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
        preloader.updateProgress(40, 'Loading 3D models...');
        ParticleHelper.BaseAssetsUrl = window.location.href;
        await RockFactory.init();
        context.setAssetsLoaded(true);
        preloader.updateProgress(70, 'Assets loaded');
    }
}

function displayLevelInfo(preloader: Preloader, levelName: string): void {
    const entry = LevelRegistry.getInstance().getLevelEntry(levelName);
    if (entry) {
        preloader.setLevelInfo(entry.name, entry.difficulty, entry.missionBrief || []);
    }
}

async function startGameWithXR(
    context: LevelSelectedContext,
    config: LevelConfig,
    levelName: string,
    preloader: Preloader
): Promise<void> {
    preloader.updateProgress(92, 'Entering VR...');
    const engine = context.getEngine();
    const xrSession = await enterXRMode(config, engine);

    const audioEngine = context.getAudioEngine();
    await audioEngine?.unlockAsync();
    preloader.updateProgress(95, 'Loading audio...');
    await RockFactory.initAudio(audioEngine);
    attachAudioListener(audioEngine);

    preloader.updateProgress(98, 'Creating level...');
    const level = new Level1(config, audioEngine, false, levelName);
    context.setCurrentLevel(level);

    level.getReadyObservable().add(async () => {
        await finalizeLevelStart(level, xrSession, engine, preloader, context);
    });

    await level.initialize();
}

function attachAudioListener(audioEngine: AudioEngineV2): void {
    const camera = DefaultScene.XR?.baseExperience?.camera || DefaultScene.MainScene.activeCamera;
    if (camera && audioEngine?.listener) {
        audioEngine.listener.attach(camera);
    }
}

async function finalizeLevelStart(
    level: Level1,
    xrSession: any,
    engine: Engine,
    preloader: Preloader,
    context: LevelSelectedContext
): Promise<void> {
    const ship = (level as any)._ship;
    ship?.onReplayRequestObservable.add(() => window.location.reload());

    if (DefaultScene.XR && xrSession && DefaultScene.XR.baseExperience.state === 2) {
        level.setupXRCamera();
        await level.showMissionBrief();
    } else {
        showCanvasForFlatMode(engine);
    }

    preloader.updateProgress(100, 'Ready!');
    preloader.hide();
    await context.play();
}

function showCanvasForFlatMode(engine: Engine): void {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.style.display = 'block';
    engine.stopRenderLoop();
    engine.runRenderLoop(() => DefaultScene.MainScene.render());
}
