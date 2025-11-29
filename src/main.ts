import {
    AudioEngineV2,
    Color3,
    CreateAudioEngineAsync,
    Engine,
    HavokPlugin,
    Scene,
    Vector3,
    WebXRDefaultExperience,
    WebXRFeaturesManager
} from "@babylonjs/core";
import '@babylonjs/loaders';
import HavokPhysics from "@babylonjs/havok";

import { DefaultScene } from "./core/defaultScene";
import Level from "./levels/level";
import { RockFactory } from "./environment/asteroids/rockFactory";
import debugLog from './core/debug';
import { InputControlManager } from './ship/input/inputControlManager';

import { initializeAnalytics } from './analytics/initAnalytics';
import { createLevelSelectedHandler, LevelSelectedContext } from './core/handlers/levelSelectedHandler';
import { initializeApp, setupErrorHandler } from './core/appInitializer';

// Initialize analytics
initializeAnalytics();

// Setup error handler
setupErrorHandler();

const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement;

enum GameState {
    PLAY,
    DEMO
}

export class Main implements LevelSelectedContext {
    private _currentLevel: Level | null = null;
    private _gameState: GameState = GameState.DEMO;
    private _engine: Engine;
    private _audioEngine: AudioEngineV2;
    private _initialized: boolean = false;
    private _assetsLoaded: boolean = false;
    private _started: boolean = false;
    private _progressCallback: ((percent: number, message: string) => void) | null = null;

    constructor(progressCallback?: (percent: number, message: string) => void) {
        this._progressCallback = progressCallback || null;

        // Register event handlers
        window.addEventListener('levelSelected', createLevelSelectedHandler(this) as EventListener);

        window.addEventListener('DOMContentLoaded', () => {
            const levelSelect = document.querySelector('#levelSelect');
            if (levelSelect) levelSelect.classList.add('ready');
        });
    }

    // LevelSelectedContext interface implementation
    isStarted(): boolean { return this._started; }
    setStarted(value: boolean): void { this._started = value; }
    isInitialized(): boolean { return this._initialized; }
    areAssetsLoaded(): boolean { return this._assetsLoaded; }
    setAssetsLoaded(value: boolean): void { this._assetsLoaded = value; }
    getAudioEngine(): AudioEngineV2 { return this._audioEngine; }
    getEngine(): Engine { return this._engine; }
    setCurrentLevel(level: Level): void { this._currentLevel = level; }
    setProgressCallback(callback: (percent: number, message: string) => void): void {
        this._progressCallback = callback;
    }

    public async initializeEngine(): Promise<void> {
        if (this._initialized) return;
        debugLog('[Main] Starting engine initialization');
        this.reportProgress(0, 'Initializing 3D engine...');
        await this.setupScene();
        this.reportProgress(30, '3D engine ready');
        await this.initializeXR();
        this._initialized = true;
        this.reportProgress(100, 'All systems ready!');
    }

    private reportProgress(percent: number, message: string): void {
        if (this._progressCallback) this._progressCallback(percent, message);
    }

    public async cleanupAndExit(): Promise<void> {
        debugLog('[Main] cleanupAndExit() called - starting graceful shutdown');
        try {
            this._engine.stopRenderLoop();
            if (this._currentLevel) {
                this._currentLevel.dispose();
                this._currentLevel = null;
            }
            RockFactory.reset();
            if (DefaultScene.XR?.baseExperience.state === 2) {
                try { await DefaultScene.XR.baseExperience.exitXRAsync(); }
                catch (error) { debugLog('[Main] Error exiting XR:', error); }
            }
            if (DefaultScene.MainScene) {
                DefaultScene.MainScene.meshes.slice().forEach(m => { if (!m.isDisposed()) m.dispose(); });
                DefaultScene.MainScene.materials.slice().forEach(m => m.dispose());
            }
            if (DefaultScene.MainScene?.isPhysicsEnabled()) {
                DefaultScene.MainScene.disablePhysicsEngine();
            }
            DefaultScene.XR = null;
            this._initialized = false;
            this._assetsLoaded = false;
            this._started = false;

            const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
            if (gl) { gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
        } catch (error) {
            console.error('[Main] Cleanup failed:', error);
            window.location.reload();
        }
    }

    public async play(): Promise<void> {
        this._gameState = GameState.PLAY;
        if (this._currentLevel) await this._currentLevel.play();
    }

    public async initializeXR(): Promise<void> {
        this.reportProgress(35, 'Checking VR support...');
        if (navigator.xr) {
            try {
                DefaultScene.XR = await WebXRDefaultExperience.CreateAsync(DefaultScene.MainScene, {
                    disableTeleportation: true,
                    disableNearInteraction: true,
                    disableHandTracking: true,
                    disableDefaultUI: true
                });
                debugLog(WebXRFeaturesManager.GetAvailableFeatures());

                DefaultScene.XR.baseExperience.onStateChangedObservable.add((state) => {
                    if (state === 2) {
                        const pointerFeature = DefaultScene.XR!.baseExperience.featuresManager.getEnabledFeature("xr-controller-pointer-selection");
                        if (pointerFeature) InputControlManager.getInstance().registerPointerFeature(pointerFeature);
                    }
                });
                this.reportProgress(40, 'VR support enabled');
            } catch (error) {
                debugLog("WebXR initialization failed:", error);
                DefaultScene.XR = null;
                this.reportProgress(40, 'Desktop mode');
            }
        } else {
            DefaultScene.XR = null;
            this.reportProgress(40, 'Desktop mode');
        }
    }

    private async setupScene(): Promise<void> {
        this.reportProgress(5, 'Creating rendering engine...');
        this._engine = new Engine(canvas, true);
        this._engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
        window.onresize = () => this._engine.resize();

        this.reportProgress(10, 'Creating scene...');
        DefaultScene.MainScene = new Scene(this._engine);
        DefaultScene.MainScene.ambientColor = new Color3(.2, .2, .2);
        DefaultScene.MainScene.clearColor = new Color3(0, 0, 0).toColor4();

        this.reportProgress(15, 'Loading physics engine...');
        await this.setupPhysics();
        this.reportProgress(20, 'Physics engine ready');

        this.reportProgress(22, 'Initializing spatial audio...');
        this._audioEngine = await CreateAudioEngineAsync({
            volume: 1.0, listenerAutoUpdate: true, listenerEnabled: true, resumeOnInteraction: true
        });
        this.reportProgress(30, 'Audio engine ready');

        this._engine.runRenderLoop(() => DefaultScene.MainScene.render());
    }

    private async setupPhysics(): Promise<void> {
        const havok = await HavokPhysics();
        const havokPlugin = new HavokPlugin(true, havok);
        DefaultScene.MainScene.enablePhysics(new Vector3(0, 0, 0), havokPlugin);
        DefaultScene.MainScene.getPhysicsEngine()!.setTimeStep(1/60);
        DefaultScene.MainScene.getPhysicsEngine()!.setSubTimeStep(5);
        DefaultScene.MainScene.collisionsEnabled = true;
    }
}

// Start the app
initializeApp(Main);
