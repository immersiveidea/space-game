/**
 * Helpers for accessing the GPUDevice from WebGPUEngine
 * and building XR session init options for WebGPU.
 */
import { WebGPUEngine } from "@babylonjs/core";

/**
 * Extract the GPUDevice from a WebGPUEngine instance.
 * WebGPUEngine stores _device privately; this accessor is stable across versions.
 */
export function getGpuDeviceFromEngine(engine: WebGPUEngine): GPUDevice {
    const device = (engine as any)._device as GPUDevice | undefined;
    if (!device) {
        throw new Error('[XR-WebGPU] Could not access GPUDevice from engine');
    }
    return device;
}

/**
 * Build XRSessionInit that adds 'webgpu' to requiredFeatures.
 */
export function buildWebGPUSessionInit(
    baseInit: XRSessionInit = {}
): XRSessionInit {
    const existing = baseInit.requiredFeatures ?? [];
    return {
        ...baseInit,
        requiredFeatures: [...existing, 'webgpu'],
    };
}
