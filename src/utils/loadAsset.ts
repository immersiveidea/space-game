import {DefaultScene} from "../defaultScene";
import {AbstractMesh, AssetContainer, LoadAssetContainerAsync} from "@babylonjs/core";

export type  LoadedAsset = {
    container: AssetContainer,
    meshes: Map<string, AbstractMesh>,
}
export default async function loadAsset(file: string, theme: string = "default"): Promise<LoadedAsset> {
    const container = await LoadAssetContainerAsync(`assets/themes/${theme}/models/${file}`, DefaultScene.MainScene);
    const map: Map<string, AbstractMesh> = new Map();
    for (const mesh of container.rootNodes[0].getChildMeshes(false)) {
        map.set(mesh.id, mesh);
    }
    return {container: container, meshes: map};
}