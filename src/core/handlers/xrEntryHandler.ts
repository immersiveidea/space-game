import { AbstractEngine, FreeCamera, Vector3, WebGPUEngine } from "@babylonjs/core";
import { DefaultScene } from "../defaultScene";
import { LevelConfig } from "../../levels/config/levelConfig";
import { isWebGPUXRAvailable, createWebGPURenderTarget, getWebGPUSessionInit } from "../xr-webgpu/xrGpuEntryPoint";
import log from '../logger';

/**
 * Pre-positions XR camera and enters immersive VR mode
 * @returns XR session if successful, null otherwise
 */
export async function enterXRMode(
    config: LevelConfig,
    engine: AbstractEngine
): Promise<any> {
    if (!DefaultScene.XR) {
        return startFlatMode(engine);
    }

    try {
        prePositionCamera(config);
        const session = isWebGPUXRAvailable(engine)
            ? await enterWebGPUXR(engine as WebGPUEngine)
            : await enterWebGLXR();
        log.debug('XR session started successfully');
        return session;
    } catch (error) {
        log.debug('Failed to enter XR, falling back to flat mode:', error);
        DefaultScene.XR = null;
        return startFlatMode(engine);
    }
}

async function enterWebGPUXR(engine: WebGPUEngine): Promise<any> {
    const base = DefaultScene.XR!.baseExperience;
    const gpuTarget = createWebGPURenderTarget(base.sessionManager, engine, DefaultScene.MainScene);
    return base.enterXRAsync('immersive-vr', 'local-floor', gpuTarget, getWebGPUSessionInit());
}

async function enterWebGLXR(): Promise<any> {
    return DefaultScene.XR!.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
}

function prePositionCamera(config: LevelConfig): void {
    const spawnPos = config.ship?.position || [0, 0, 0];
    const cockpitPosition = new Vector3(spawnPos[0], spawnPos[1] + 1.2, spawnPos[2]);
    const tempCamera = new FreeCamera("tempCockpit", cockpitPosition, DefaultScene.MainScene);
    DefaultScene.XR!.baseExperience.camera.setTransformationFromNonVRCamera(tempCamera, true);
    tempCamera.dispose();
    log.debug('[XR] Camera pre-positioned at cockpit:', cockpitPosition.toString());
}

function startFlatMode(engine: AbstractEngine): null {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.style.display = 'block';
    engine.stopRenderLoop();
    engine.runRenderLoop(() => DefaultScene.MainScene.render());
    return null;
}
