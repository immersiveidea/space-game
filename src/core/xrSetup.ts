import {
    WebXRDefaultExperience, WebXRFeaturesManager, WebXRFeatureName, WebXRState,
    MeshBuilder, StandardMaterial, Color3, Animation, Mesh
} from "@babylonjs/core";
import { DefaultScene } from "./defaultScene";
import { InputControlManager } from "../ship/input/inputControlManager";
import log from './logger';

const XR_RENDERING_GROUP = 3;
const FADE_DELAY_MS = 500;
const FADE_DURATION_FRAMES = 60;

let fadeSphere: Mesh | null = null;
let xrStartTime = 0;

function xrLog(message: string): void {
    const elapsed = xrStartTime ? Date.now() - xrStartTime : 0;
    log.debug(`[XR +${elapsed}ms] ${message}`);
}

export interface ProgressReporter {
    reportProgress(percent: number, message: string): void;
}

/**
 * Initialize WebXR experience if available
 */
export async function initializeXR(reporter: ProgressReporter): Promise<void> {
    reporter.reportProgress(35, 'Checking VR support...');

    if (!navigator.xr) {
        DefaultScene.XR = null;
        reporter.reportProgress(40, 'Desktop mode');
        return;
    }

    try {
        await createXRExperience();
        registerXRStateHandler();
        reporter.reportProgress(40, 'VR support enabled');
    } catch (error) {
        log.debug("WebXR initialization failed:", error);
        DefaultScene.XR = null;
        reporter.reportProgress(40, 'Desktop mode');
    }
}

async function createXRExperience(): Promise<void> {
    DefaultScene.XR = await WebXRDefaultExperience.CreateAsync(DefaultScene.MainScene, {
        disableTeleportation: true,
        disableNearInteraction: true,
        disableHandTracking: true,
        disableDefaultUI: true,
        disablePointerSelection: true  // Disable to re-enable with custom options
    });
    log.debug(WebXRFeaturesManager.GetAvailableFeatures());

    // Enable pointer selection with renderingGroupId so laser is never occluded
    DefaultScene.XR.baseExperience.featuresManager.enableFeature(
        WebXRFeatureName.POINTER_SELECTION,
        "stable",
        {
            xrInput: DefaultScene.XR.input,
            renderingGroupId: XR_RENDERING_GROUP,
            disablePointerUpOnTouchOut: false,
            forceGazeMode: false,
            disableScenePointerVectorUpdate: true // VR mode doesn't need scene pointer updates
        }
    );
    log.debug('Pointer selection enabled with renderingGroupId:', XR_RENDERING_GROUP);
    createFadeSphere();
}

function createFadeSphere(): void {
    const scene = DefaultScene.MainScene;
    fadeSphere = MeshBuilder.CreateSphere("xrFade", { diameter: 2, sideOrientation: Mesh.BACKSIDE }, scene);
    const mat = new StandardMaterial("xrFadeMat", scene);
    mat.emissiveColor = Color3.Black();
    mat.disableLighting = true;
    fadeSphere.material = mat;
    fadeSphere.isPickable = false;
    fadeSphere.setEnabled(false); // Hidden until XR entry
}

function fadeInScene(): void {
    if (!fadeSphere?.material) return;
    xrLog(`Scheduling fade-in after ${FADE_DELAY_MS}ms delay`);
    setTimeout(() => {
        xrLog('Starting fade-in animation');
        Animation.CreateAndStartAnimation(
            "xrFadeIn", fadeSphere!.material!, "alpha",
            60, FADE_DURATION_FRAMES, 1, 0, Animation.ANIMATIONLOOPMODE_CONSTANT
        );
    }, FADE_DELAY_MS);
}

function registerXRStateHandler(): void {
    const sessionMgr = DefaultScene.XR!.baseExperience.sessionManager;
    const xrCamera = DefaultScene.XR!.baseExperience.camera;

    // Earliest hook - session requested and returned
    sessionMgr.onXRSessionInit.add(() => {
        xrLog('onXRSessionInit - session created');
        xrLog(`  Camera pos: ${xrCamera.position.toString()}`);
        xrLog(`  Camera parent: ${xrCamera?.parent?.id}`);
    });

    // Frame-level logging (first few frames only)
    let frameCount = 0;
    sessionMgr.onXRFrameObservable.add(() => {
        frameCount++;
        if (frameCount <= 5) {
            xrLog(`Frame ${frameCount} - Camera pos: ${xrCamera.position.toString()}`);
        }
    });

    DefaultScene.XR!.baseExperience.onStateChangedObservable.add((state) => {
        const stateName = WebXRState[state];
        xrLog(`State: ${stateName}`);
        xrLog(`  Camera pos: ${xrCamera.position.toString()}`);
        xrLog(`  Fade sphere enabled: ${fadeSphere?.isEnabled()}`);

        if (state === WebXRState.ENTERING_XR) {
            xrStartTime = Date.now();
            xrLog('ENTERING_XR - Starting XR entry');
            if (fadeSphere) {
                fadeSphere.parent = xrCamera;
                const cameraRig = DefaultScene.MainScene.getTransformNodeByName('xrCameraRig');
                if (!cameraRig) {
                    xrLog('  WARNING: xrCameraRig not found - camera will not be parented to ship');
                } else {
                    xrLog(`  XR Camera Rig found: ${cameraRig.name}`);
                    xrCamera.parent = cameraRig;
                }
                fadeSphere.setEnabled(true);
                xrLog('  Fade sphere parented and enabled');
            }
        }
        if (state === WebXRState.IN_XR) {
            xrLog('IN_XR - First frame received, camera positioned');
            registerPointerFeature();
            fadeInScene();
        }
        if (state === WebXRState.NOT_IN_XR && fadeSphere) {
            fadeSphere.setEnabled(false);
            xrStartTime = 0;
        }
    });
}

function registerPointerFeature(): void {
    const pointerFeature = DefaultScene.XR!.baseExperience.featuresManager
        .getEnabledFeature("xr-controller-pointer-selection");
    if (pointerFeature) {
        InputControlManager.getInstance().registerPointerFeature(pointerFeature);
    }
}
