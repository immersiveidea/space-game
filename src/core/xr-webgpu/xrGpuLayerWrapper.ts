/**
 * WebXRLayerWrapper subclass for XRProjectionLayer created via XRGPUBinding.
 */
import { WebGPUEngine } from "@babylonjs/core";
import { WebXRLayerWrapper } from "@babylonjs/core/XR/webXRLayerWrapper";
import type { Scene } from "@babylonjs/core";
import { XRGPUTextureProvider } from "./xrGpuTextureProvider";
import type { XRGPUBinding } from "./xrGpuTypes";

export class XRGPUProjectionLayerWrapper extends WebXRLayerWrapper {
    constructor(
        public override readonly layer: XRProjectionLayer,
        private readonly _gpuBinding: XRGPUBinding,
        private readonly _gpuEngine: WebGPUEngine,
        private readonly _scene: Scene
    ) {
        super(
            () => layer.textureWidth,
            () => layer.textureHeight,
            layer,
            "XRProjectionLayer",
            (sessionManager) =>
                new XRGPUTextureProvider(
                    sessionManager.scene,
                    this,
                    _gpuBinding,
                    layer,
                    _gpuEngine
                )
        );
    }
}
