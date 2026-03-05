import {
    MeshBuilder, ActionManager, ExecuteCodeAction,
    StandardMaterial, Texture, WebXRState,
} from '@babylonjs/core';
import type { Scene, Mesh, WebXRDefaultExperience } from '@babylonjs/core';
import { formats } from './zestyFormats';
import {
    fetchCampaignAd, sendOnLoadMetric, sendOnClickMetric,
    AD_REFRESH_INTERVAL,
} from './zestyNetworking';
import type { AdData } from './zestyNetworking';

function getCamera(scene: Scene, xr?: WebXRDefaultExperience) {
    if (xr?.baseExperience?.state === WebXRState.IN_XR) {
        return xr.baseExperience.camera;
    }
    return scene.cameras.length > 0 ? scene.cameras[0] : null;
}

async function loadAd(
    banner: Mesh, scene: Scene, adUnitId: string,
    format: string, adRef: { current: AdData }
): Promise<void> {
    const ad = await fetchCampaignAd(adUnitId, format);
    adRef.current = ad;
    const mat = banner.material as StandardMaterial;
    mat.emissiveTexture?.dispose();
    const tex = new Texture(ad.assetUrl, scene);
    tex.hasAlpha = true;
    mat.emissiveTexture = tex;

    if (ad.campaignId) sendOnLoadMetric(adUnitId, ad.campaignId);
}

function openUrl(url: string): void {
    window.open(url, '_blank');
}

export function createZestyBanner(
    adUnitId: string, format: string, height: number,
    scene: Scene, xr?: WebXRDefaultExperience
): Mesh {
    const fmt = formats[format] ?? formats['billboard'];
    const planeOpts = { width: fmt.width * height, height };
    const banner = MeshBuilder.CreatePlane('zestybanner', planeOpts, scene);

    const mat = new StandardMaterial('zestyMat', scene);
    mat.emissiveTexture = new Texture(fmt.defaultImage, scene);
    (mat.emissiveTexture as Texture).hasAlpha = true;
    banner.material = mat;

    const adRef = { current: { assetUrl: '', ctaUrl: '', campaignId: '' } };
    loadAd(banner, scene, adUnitId, format, adRef);

    banner.actionManager = new ActionManager(scene);
    banner.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
            if (!adRef.current.ctaUrl) return;
            if (xr?.baseExperience) {
                xr.baseExperience.sessionManager.exitXRAsync()
                    .then(() => openUrl(adRef.current.ctaUrl));
            } else {
                openUrl(adRef.current.ctaUrl);
            }
            if (adRef.current.campaignId) {
                sendOnClickMetric(adUnitId, adRef.current.campaignId);
            }
        })
    );

    setInterval(() => {
        const cam = getCamera(scene, xr);
        if (!cam || !scene.isActiveMesh(banner)) return;
        loadAd(banner, scene, adUnitId, format, adRef);
    }, AD_REFRESH_INTERVAL);

    return banner;
}
