import {DefaultScene} from "../core/defaultScene";
import {AbstractMesh, AssetContainer, LoadAssetContainerAsync} from "@babylonjs/core";
import log from "../core/logger";

type LoadedAsset = {
    container: AssetContainer,
    meshes: Map<string, AbstractMesh>,
}

interface LoadAssetOptions {
    hidden?: boolean;  // If true, meshes are added to scene but disabled/invisible
}

// Cache for prefetched asset containers (not yet added to scene)
const prefetchedContainers: Map<string, AssetContainer> = new Map();

/**
 * Prefetch an asset (download and parse, but don't add to scene yet)
 */
export async function prefetchAsset(file: string, theme: string = "default"): Promise<void> {
    const cacheKey = `${theme}/${file}`;
    if (prefetchedContainers.has(cacheKey)) return;

    const assetPath = `/assets/themes/${theme}/models/${file}`;
    log.debug(`[prefetchAsset] Prefetching: ${assetPath}`);
    const container = await LoadAssetContainerAsync(assetPath, DefaultScene.MainScene);
    prefetchedContainers.set(cacheKey, container);
    log.debug(`[prefetchAsset] ✓ Prefetched ${file}`);
}

export default async function loadAsset(
    file: string,
    theme: string = "default",
    options: LoadAssetOptions = {}
): Promise<LoadedAsset> {
    const cacheKey = `${theme}/${file}`;
    const assetPath = `/assets/themes/${theme}/models/${file}`;
    log.debug(`[loadAsset] Loading: ${assetPath}`);

    try {
        // Use prefetched container if available, otherwise load fresh
        let container = prefetchedContainers.get(cacheKey);
        if (container) {
            log.debug(`[loadAsset] ✓ Using prefetched container for ${file}`);
            prefetchedContainers.delete(cacheKey); // Remove from cache after use
        } else {
            container = await LoadAssetContainerAsync(assetPath, DefaultScene.MainScene);
            log.debug(`[loadAsset] ✓ Container loaded for ${file}`);
        }

        const map: Map<string, AbstractMesh> = new Map();
        container.addAllToScene();

        log.debug(`[loadAsset] Root nodes count: ${container.rootNodes.length}`);
        if (container.rootNodes.length === 0) {
            log.error(`[loadAsset] ERROR: No root nodes found in ${file}`);
            return {container: container, meshes: map};
        }

        const shouldHide = options.hidden === true;

        for (const mesh of container.rootNodes[0].getChildMeshes(false)) {
            log.info(mesh.id, mesh);

            // Set visibility based on hidden option
            mesh.isVisible = !shouldHide;
            mesh.setEnabled(!shouldHide);

            // Fix emissive materials to work without lighting
            if (mesh.material) {
                const material = mesh.material as any;
                if (material.disableLighting !== undefined) {
                    material.disableLighting = true;
                }
            }

            map.set(mesh.id, mesh);
        }

        log.debug(`[loadAsset] ✓ Loaded ${map.size} meshes from ${file} (hidden: ${shouldHide})`);
        return {container: container, meshes: map};
    } catch (error) {
        log.error(`[loadAsset] FAILED to load ${assetPath}:`, error);
        throw error;
    }
}

/**
 * Show all meshes in a loaded asset container (for assets loaded with hidden: true)
 */
export function showAssetMeshes(asset: LoadedAsset): void {
    for (const mesh of asset.meshes.values()) {
        mesh.isVisible = true;
        mesh.setEnabled(true);
    }
    log.debug(`[showAssetMeshes] Showed ${asset.meshes.size} meshes`);
}