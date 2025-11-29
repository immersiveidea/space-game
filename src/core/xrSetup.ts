import { WebXRDefaultExperience, WebXRFeaturesManager } from "@babylonjs/core";
import { DefaultScene } from "./defaultScene";
import { InputControlManager } from "../ship/input/inputControlManager";
import debugLog from './debug';

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
        debugLog("WebXR initialization failed:", error);
        DefaultScene.XR = null;
        reporter.reportProgress(40, 'Desktop mode');
    }
}

async function createXRExperience(): Promise<void> {
    DefaultScene.XR = await WebXRDefaultExperience.CreateAsync(DefaultScene.MainScene, {
        disableTeleportation: true,
        disableNearInteraction: true,
        disableHandTracking: true,
        disableDefaultUI: true
    });
    debugLog(WebXRFeaturesManager.GetAvailableFeatures());
}

function registerXRStateHandler(): void {
    DefaultScene.XR!.baseExperience.onStateChangedObservable.add((state) => {
        if (state === 2) {
            const pointerFeature = DefaultScene.XR!.baseExperience.featuresManager
                .getEnabledFeature("xr-controller-pointer-selection");
            if (pointerFeature) {
                InputControlManager.getInstance().registerPointerFeature(pointerFeature);
            }
        }
    });
}
