import {DefaultScene} from "../core/defaultScene";
import {AbstractMesh, AssetContainer, LoadAssetContainerAsync} from "@babylonjs/core";
import debugLog from "../core/debug";

export type  LoadedAsset = {
    container: AssetContainer,
    meshes: Map<string, AbstractMesh>,
}
export default async function loadAsset(file: string, theme: string = "default"): Promise<LoadedAsset> {
    const assetPath = `assets/themes/${theme}/models/${file}`;
    debugLog(`[loadAsset] Loading: ${assetPath}`);

    try {
        const container = await LoadAssetContainerAsync(assetPath, DefaultScene.MainScene);
        debugLog(`[loadAsset] ✓ Container loaded for ${file}`);

        const map: Map<string, AbstractMesh> = new Map();
        container.addAllToScene();

        debugLog(`[loadAsset] Root nodes count: ${container.rootNodes.length}`);
        if (container.rootNodes.length === 0) {
            console.error(`[loadAsset] ERROR: No root nodes found in ${file}`);
            return {container: container, meshes: map};
        }

        for (const mesh of container.rootNodes[0].getChildMeshes(false)) {
            console.log(mesh.id, mesh);
            // Ensure mesh is visible and enabled
            mesh.isVisible = true;
            mesh.setEnabled(true);

            // Fix emissive materials to work without lighting
            if (mesh.material) {
                const material = mesh.material as any;

                // Disable lighting on materials so emissive works without light sources
                if (material.disableLighting !== undefined) {
                    material.disableLighting = true;
                }
            }

            map.set(mesh.id, mesh);
        }

        debugLog(`[loadAsset] ✓ Loaded ${map.size} meshes from ${file}`);
        return {container: container, meshes: map};
    } catch (error) {
        console.error(`[loadAsset] FAILED to load ${assetPath}:`, error);
        throw error;
    }
}