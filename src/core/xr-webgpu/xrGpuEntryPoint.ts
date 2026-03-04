/**
 * Public API for WebGPU XR support.
 * Consumed by xrEntryHandler.ts to conditionally use the WebGPU XR path.
 */
import { WebGPUEngine } from "@babylonjs/core";
import type { AbstractEngine, Scene, WebXRSessionManager } from "@babylonjs/core";
import { XRGPURenderTarget } from "./xrGpuRenderTarget";
import { buildWebGPUSessionInit } from "./xrGpuSessionSetup";
import "./xrGpuTypes"; // ensure global XRGPUBinding augmentation is loaded

export function isWebGPUXRAvailable(engine: AbstractEngine): boolean {
    return (
        engine instanceof WebGPUEngine &&
        typeof globalThis.XRGPUBinding !== 'undefined'
    );
}

export function createWebGPURenderTarget(
    sessionManager: WebXRSessionManager,
    engine: WebGPUEngine,
    scene: Scene
): XRGPURenderTarget {
    return new XRGPURenderTarget(sessionManager, engine, scene);
}

export function getWebGPUSessionInit(): XRSessionInit {
    return buildWebGPUSessionInit();
}
