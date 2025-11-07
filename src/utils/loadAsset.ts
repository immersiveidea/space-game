import {DefaultScene} from "../defaultScene";
import {AbstractMesh, AssetContainer, LoadAssetContainerAsync} from "@babylonjs/core";

export type  LoadedAsset = {
    container: AssetContainer,
    meshes: Map<string, AbstractMesh>,
}
export default async function loadAsset(file: string, theme: string = "default"): Promise<LoadedAsset> {
    const container = await LoadAssetContainerAsync(`assets/themes/${theme}/models/${file}`, DefaultScene.MainScene);
    const map: Map<string, AbstractMesh> = new Map();
    container.addAllToScene();
    for (const mesh of container.rootNodes[0].getChildMeshes(false)) {
        console.log(mesh.id, mesh);
        //mesh.setParent(null);
        //mesh.rotation.y = Math.PI /2;
        //mesh.rotation.z = Math.PI;
        map.set(mesh.id, mesh);
    }
    return {container: container, meshes: map};
}