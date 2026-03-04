/**
 * TypeScript declarations for WebXR-WebGPU Binding spec types.
 * These are not yet in lib.dom or BabylonJS type definitions.
 * @see https://github.com/immersive-web/WebXR-WebGPU-Binding/blob/main/explainer.md
 */

export interface XRGPUProjectionLayerInit {
    textureFormat?: GPUTextureFormat;
    depthStencilFormat?: GPUTextureFormat;
    scaleFactor?: number;
}

export interface XRGPUSubImage {
    colorTexture: GPUTexture;
    depthStencilTexture?: GPUTexture;
    imageIndex: number;
    viewport: { x: number; y: number; width: number; height: number };
}

export interface XRGPUBinding {
    createProjectionLayer(init?: XRGPUProjectionLayerInit): XRProjectionLayer;
    getViewSubImage(layer: XRProjectionLayer, view: XRView): XRGPUSubImage;
}

export interface XRGPUBindingConstructor {
    new (session: XRSession, device: GPUDevice): XRGPUBinding;
}

/** Global augmentation for XRGPUBinding constructor */
declare global {
    // eslint-disable-next-line no-var
    var XRGPUBinding: XRGPUBindingConstructor | undefined;
}
