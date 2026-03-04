/**
 * WebGPU XR texture provider — gets GPUTexture per-view from XRGPUBinding
 * and swaps it into the cached RenderTargetTexture each frame.
 */
import { RenderTargetTexture, WebGPUEngine, WebXRLayerRenderTargetTextureProvider } from "@babylonjs/core";
import type { Viewport, Scene, Nullable } from "@babylonjs/core";
import type { WebXRLayerWrapper } from "@babylonjs/core/XR/webXRLayerWrapper";
import type { XRGPUBinding, XRGPUSubImage } from "./xrGpuTypes";
import log from '../logger';

export class XRGPUTextureProvider extends WebXRLayerRenderTargetTextureProvider {
    private _gpuBinding: XRGPUBinding;
    private _projLayer: XRProjectionLayer;
    private _gpuEngine: WebGPUEngine;
    private _xrScene: Scene;

    constructor(
        scene: Scene,
        layerWrapper: WebXRLayerWrapper,
        gpuBinding: XRGPUBinding,
        projectionLayer: XRProjectionLayer,
        gpuEngine: WebGPUEngine
    ) {
        super(scene, layerWrapper);
        this._gpuBinding = gpuBinding;
        this._projLayer = projectionLayer;
        this._gpuEngine = gpuEngine;
        this._xrScene = scene;
        this._framebufferDimensions = {
            framebufferWidth: projectionLayer.textureWidth,
            framebufferHeight: projectionLayer.textureHeight,
        };
    }

    public getRenderTargetTextureForView(view: XRView): Nullable<RenderTargetTexture> {
        const subImage = this._gpuBinding.getViewSubImage(this._projLayer, view);
        const idx = view.eye === "right" ? 1 : 0;
        if (!this._renderTargetTextures[idx]) {
            this._renderTargetTextures[idx] = this._createGpuRTT(subImage);
        } else {
            this._swapGpuTexture(this._renderTargetTextures[idx], subImage);
        }
        return this._renderTargetTextures[idx];
    }

    public getRenderTargetTextureForEye(eye: XREye): Nullable<RenderTargetTexture> {
        return this._renderTargetTextures[eye === "right" ? 1 : 0] ?? null;
    }

    public trySetViewportForView(viewport: Viewport, view: XRView): boolean {
        const sub = this._gpuBinding.getViewSubImage(this._projLayer, view);
        if (!sub) return false;
        const w = this._projLayer.textureWidth;
        const h = this._projLayer.textureHeight;
        viewport.x = sub.viewport.x / w;
        viewport.y = sub.viewport.y / h;
        viewport.width = sub.viewport.width / w;
        viewport.height = sub.viewport.height / h;
        return true;
    }

    private _createGpuRTT(subImage: XRGPUSubImage): RenderTargetTexture {
        const w = this._projLayer.textureWidth;
        const h = this._projLayer.textureHeight;
        const internalTex = this._gpuEngine.wrapWebGPUTexture(subImage.colorTexture);
        internalTex.width = w;
        internalTex.height = h;
        const rtt = new RenderTargetTexture("xrGpuRTT", { width: w, height: h }, this._xrScene);
        const origTex = rtt._texture;
        rtt._texture = internalTex;
        rtt.renderTarget!.setTexture(internalTex, 0);
        origTex?.dispose();
        rtt.disableRescaling();
        log.debug(`[XR-WebGPU] Created RTT ${w}x${h}`);
        return rtt;
    }

    private _swapGpuTexture(rtt: RenderTargetTexture, subImage: XRGPUSubImage): void {
        const hwTex = rtt._texture?._hardwareTexture as any;
        if (!hwTex?.set) return;
        hwTex.set(subImage.colorTexture);
        hwTex.view = null;
        hwTex.viewForWriting = null;
    }
}
