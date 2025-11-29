import {
    AudioEngineV2,
    Color3,
    CreateAudioEngineAsync,
    Engine,
    HavokPlugin,
    Scene,
    Vector3
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { DefaultScene } from "./defaultScene";
import { ProgressReporter } from "./xrSetup";

export interface SceneSetupResult {
    engine: Engine;
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
    const engine = createEngine(canvas);

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

function createEngine(canvas: HTMLCanvasElement): Engine {
    const engine = new Engine(canvas, true);
    engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
    window.onresize = () => engine.resize();
    return engine;
}

function createMainScene(engine: Engine): void {
    // Dispose old scene if it exists (prevents doubling on reload)
    if (DefaultScene.MainScene && !DefaultScene.MainScene.isDisposed) {
        DefaultScene.MainScene.dispose();
    }
    DefaultScene.MainScene = new Scene(engine);
    DefaultScene.MainScene.ambientColor = new Color3(.2, .2, .2);
    DefaultScene.MainScene.clearColor = new Color3(0, 0, 0).toColor4();
}

async function setupPhysics(): Promise<void> {
    const havok = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havok);
    DefaultScene.MainScene.enablePhysics(new Vector3(0, 0, 0), havokPlugin);
    DefaultScene.MainScene.getPhysicsEngine()!.setTimeStep(1/60);
    DefaultScene.MainScene.getPhysicsEngine()!.setSubTimeStep(5);
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
