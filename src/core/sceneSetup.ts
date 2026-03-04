import {
    AbstractEngine,
    AudioEngineV2,
    Color3,
    CreateAudioEngineAsync,
    Engine,
    HavokPlugin,
    Scene,
    Vector3,
    WebGPUEngine,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { DefaultScene } from "./defaultScene";
import { ProgressReporter } from "./xrSetup";
import { useWebGPU } from "./queryParams";
import log from './logger';

export interface SceneSetupResult {
    engine: AbstractEngine;
    audioEngine: AudioEngineV2;
}

/**
 * Setup the BabylonJS engine, scene, physics, and audio
 */
export async function setupScene(
    canvas: HTMLCanvasElement,
    reporter: ProgressReporter
): Promise<SceneSetupResult> {
    reporter.reportProgress(5, 'Creating rendering engine...');
    const engine = await createEngine(canvas);

    reporter.reportProgress(10, 'Creating scene...');
    createMainScene(engine);

    reporter.reportProgress(15, 'Loading physics engine...');
    await setupPhysics();
    reporter.reportProgress(20, 'Physics engine ready');

    reporter.reportProgress(22, 'Initializing spatial audio...');
    const audioEngine = await createAudioEngine();
    reporter.reportProgress(30, 'Audio engine ready');

    // Stop any existing render loop before starting new one (prevents doubling on reload)
    engine.stopRenderLoop();
    engine.runRenderLoop(() => DefaultScene.MainScene.render());

    return { engine, audioEngine };
}

async function createEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
    const engine = useWebGPU
        ? await tryCreateWebGPUEngine(canvas)
        : null;
    const finalEngine = engine ?? createWebGLEngine(canvas);
    finalEngine.setHardwareScalingLevel(1 / window.devicePixelRatio);
    window.onresize = () => finalEngine.resize();
    return finalEngine;
}

async function tryCreateWebGPUEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine | null> {
    if (!navigator.gpu) {
        log.warn('[Engine] WebGPU requested but navigator.gpu not available');
        return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        log.warn('[Engine] No WebGPU adapter found');
        return null;
    }
    log.info(`[Engine] WebGPU adapter: ${adapter.info?.vendor ?? 'unknown'}`);
    try {
        const gpuEngine = new WebGPUEngine(canvas, { antialias: true });
        await gpuEngine.initAsync();
        log.info('[Engine] WebGPU engine ready — WebXR will use XRGPUBinding if available');
        return gpuEngine;
    } catch (e) {
        log.error('[Engine] WebGPU initialization failed', e);
        return null;
    }
}

function createWebGLEngine(canvas: HTMLCanvasElement): AbstractEngine {
    log.info('[Engine] Creating WebGL engine');
    return new Engine(canvas, true);
}

function createMainScene(engine: AbstractEngine): void {
    // Dispose old scene if it exists (prevents doubling on reload)
    if (DefaultScene.MainScene && !DefaultScene.MainScene.isDisposed) {
        DefaultScene.MainScene.dispose();
    }
    DefaultScene.MainScene = new Scene(engine);
    DefaultScene.MainScene.ambientColor = new Color3(.2, .2, .2);
    DefaultScene.MainScene.clearColor = new Color3(0, 0, 0).toColor4();

    // Performance optimizations for Quest 2
    //DefaultScene.MainScene.performancePriority = ScenePerformancePriority.Intermediate;
    DefaultScene.MainScene.autoClear = false;
    DefaultScene.MainScene.autoClearDepthAndStencil = false;
    //const hdrTexture = new HDRCubeTexture("/assets/untitled.hdr", DefaultScene.MainScene, 2048);
    //DefaultScene.MainScene.environmentTexture = hdrTexture;
    //DefaultScene.MainScene.createDefaultSkybox(hdrTexture, true, 1000);
}

async function setupPhysics(): Promise<void> {
    const havok = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havok);
    DefaultScene.MainScene.enablePhysics(new Vector3(0, 0, 0), havokPlugin);
    DefaultScene.MainScene.getPhysicsEngine()!.setTimeStep(1/60);
    DefaultScene.MainScene.getPhysicsEngine()!.setSubTimeStep(2);
    DefaultScene.MainScene.collisionsEnabled = true;
}

async function createAudioEngine(): Promise<AudioEngineV2> {
    return await CreateAudioEngineAsync({
        volume: 1.0,
        listenerAutoUpdate: true,
        listenerEnabled: true,
        resumeOnInteraction: true
    });
}
