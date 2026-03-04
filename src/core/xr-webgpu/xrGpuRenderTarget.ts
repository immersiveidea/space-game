/**
 * WebXRRenderTarget implementation for WebGPU.
 * Creates XRGPUBinding + projection layer instead of XRWebGLLayer.
 */
import { WebGPUEngine } from "@babylonjs/core";
import type { Scene, Nullable, WebXRSessionManager, WebXRRenderTarget } from "@babylonjs/core";
import { XRGPUProjectionLayerWrapper } from "./xrGpuLayerWrapper";
import { getGpuDeviceFromEngine } from "./xrGpuSessionSetup";
import type { XRGPUBinding, XRGPUBindingConstructor } from "./xrGpuTypes";
import log from '../logger';

export class XRGPURenderTarget implements WebXRRenderTarget {
    /** Unused in WebGPU path — required by interface */
    public canvasContext: WebGLRenderingContext = null as any;
    /** Unused in WebGPU path — required by interface */
    public xrLayer: Nullable<XRWebGLLayer> = null;

    private _sessionManager: WebXRSessionManager;
    private _engine: WebGPUEngine;
    private _scene: Scene;

    constructor(sessionManager: WebXRSessionManager, engine: WebGPUEngine, scene: Scene) {
        this._sessionManager = sessionManager;
        this._engine = engine;
        this._scene = scene;
    }

    public async initializeXRLayerAsync(xrSession: XRSession): Promise<XRWebGLLayer> {
        const device = getGpuDeviceFromEngine(this._engine);
        const Binding = globalThis.XRGPUBinding as XRGPUBindingConstructor;
        const gpuBinding: XRGPUBinding = new Binding(xrSession, device);

        const projectionLayer = gpuBinding.createProjectionLayer({
            textureFormat: 'rgba8unorm',
            depthStencilFormat: 'depth24plus-stencil8',
        });

        log.info('[XR-WebGPU] Projection layer created:', projectionLayer.textureWidth, 'x', projectionLayer.textureHeight);

        xrSession.updateRenderState({ layers: [projectionLayer] } as any);

        const wrapper = new XRGPUProjectionLayerWrapper(
            projectionLayer, gpuBinding, this._engine, this._scene
        );
        this._sessionManager._setBaseLayerWrapper(wrapper);

        log.info('[XR-WebGPU] Layer wrapper set on session manager');
        return null as any;
    }

    public dispose(): void {
        /* nothing to clean up — layer lifetime is tied to XR session */
    }
}
