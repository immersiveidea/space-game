import { AudioEngineV2, Engine } from "@babylonjs/core";
import '@babylonjs/loaders';

import { DefaultScene } from "./core/defaultScene";
import Level from "./levels/level";
import log from './core/logger';

import { initializeAnalytics } from './analytics/initAnalytics';
import { createLevelSelectedHandler, LevelSelectedContext } from './core/handlers/levelSelectedHandler';
import { initializeApp, setupErrorHandler } from './core/appInitializer';
import { cleanupAndExit, CleanupContext } from './core/cleanup';
import { initializeXR } from './core/xrSetup';
import { setupScene } from './core/sceneSetup';

// Initialize analytics and error handler
initializeAnalytics();
setupErrorHandler();

const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement;

export class Main implements LevelSelectedContext, CleanupContext {
    private _currentLevel: Level | null = null;
    private _engine: Engine;
    private _audioEngine: AudioEngineV2;
    private _initialized: boolean = false;
    private _assetsLoaded: boolean = false;
    private _started: boolean = false;
    private _progressCallback: ((percent: number, message: string) => void) | null = null;

    constructor(progressCallback?: (percent: number, message: string) => void) {
        this._progressCallback = progressCallback || null;
        window.addEventListener('levelSelected', createLevelSelectedHandler(this) as EventListener);
        window.addEventListener('DOMContentLoaded', () => {
            const levelSelect = document.querySelector('#levelSelect');
            if (levelSelect) levelSelect.classList.add('ready');
        });
    }

    // LevelSelectedContext interface
    isStarted(): boolean { return this._started; }
    setStarted(value: boolean): void { this._started = value; }
    isInitialized(): boolean { return this._initialized; }
    areAssetsLoaded(): boolean { return this._assetsLoaded; }
    setAssetsLoaded(value: boolean): void { this._assetsLoaded = value; }
    getAudioEngine(): AudioEngineV2 { return this._audioEngine; }
    getEngine(): Engine { return this._engine; }
    setCurrentLevel(level: Level): void { this._currentLevel = level; }
    setProgressCallback(cb: (percent: number, message: string) => void): void {
        this._progressCallback = cb;
    }

    // CleanupContext interface
    getCurrentLevel(): Level | null { return this._currentLevel; }
    resetState(): void {
        this._initialized = false;
        this._assetsLoaded = false;
        this._started = false;
    }

    public async initializeEngine(): Promise<void> {
        if (this._initialized) return;
        log.debug('[Main] Starting engine initialization');
        this.reportProgress(0, 'Initializing 3D engine...');
        const result = await setupScene(canvas, this);
        this._engine = result.engine;
        this._audioEngine = result.audioEngine;
        this.reportProgress(30, '3D engine ready');
        await initializeXR(this);
        this._initialized = true;
        this.reportProgress(100, 'All systems ready!');
    }

    public reportProgress(percent: number, message: string): void {
        if (this._progressCallback) this._progressCallback(percent, message);
    }

    public async cleanupAndExit(): Promise<void> {
        await cleanupAndExit(this, canvas);
    }

    public async play(): Promise<void> {
        if (this._currentLevel) await this._currentLevel.play();
    }

    public async initializeXR(): Promise<void> {
        await initializeXR(this);
    }
}

// Start the app
initializeApp(Main);
