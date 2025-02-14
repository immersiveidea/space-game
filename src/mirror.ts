import {FreeCamera, MeshBuilder, RenderTargetTexture, StandardMaterial, TransformNode, Vector3} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";

export class Mirror {
    constructor(ship: TransformNode) {
        const renderTargetTexture = new RenderTargetTexture('mirror', 512, DefaultScene.MainScene);
        const camera = new FreeCamera("mirrorCamera", new Vector3(0, 0, -5), DefaultScene.MainScene);
        camera.parent = ship;
        //camera.rotation.y = Math.PI;
        renderTargetTexture.activeCamera = camera;
        renderTargetTexture.renderList.push(DefaultScene.MainScene.getMeshByName("shipMesh"));
        const mirror = MeshBuilder.CreatePlane("mirrorMesh" , {width: 1, height: 1}, DefaultScene.MainScene);
        mirror.parent = ship;
        const mirrorMaterial = new StandardMaterial("mirrorMaterial", DefaultScene.MainScene);

        mirrorMaterial.backFaceCulling = false;
        mirrorMaterial.diffuseTexture = renderTargetTexture;
        mirror.material = mirrorMaterial;
        mirror.position = new Vector3(0, 1, 5);
        mirror.rotation.y = Math.PI;
    }
}