import {DefaultScene} from "./defaultScene";
import {
    AbstractMesh,
    Color3,
    HavokPlugin, InstancedMesh, Mesh,
    MeshBuilder, Ray, SceneLoader,
    StandardMaterial,
    TransformNode,
    Vector3
} from "@babylonjs/core";

const DETECTED: Color3 = Color3.Blue();
const WARN: Color3 = Color3.Yellow();
const DANGER: Color3 = Color3.Red();
const DETECTED_DISTANCE = 100;
const WARN_DISTANCE = 50;
const DANGER_DISTANCE = 30;
export class Radar {
    private _shipTransform: TransformNode;
    private _radarTransform: TransformNode;
    private _arrowMesh: AbstractMesh;
    constructor(ship: TransformNode) {
        this._shipTransform = ship;
        this._radarTransform = new TransformNode('radar', DefaultScene.MainScene);
        this._radarTransform.parent = ship;
        const sphere = MeshBuilder.CreateSphere('radarSphere', {diameter: 1}, DefaultScene.MainScene);
        sphere.parent = this._radarTransform;
        const material = new StandardMaterial('radarMaterial', DefaultScene.MainScene);
        material.diffuseColor = Color3.Yellow();
        material.alpha = .5;
        sphere.material = material;
        // dmaterial.alpha = .1;
        this._radarTransform.position.z = 4;
        //this._radarTransform.scaling = new Vector3(.01, .01 ,.01);
        this.initialize();

    }

    private async initialize() {
        const scene = DefaultScene.MainScene;
        const arrow = await SceneLoader.ImportMeshAsync(null, './', 'arrow.stl', scene);
        //arrow.meshes[0].parent = this._radarTransform;
        arrow.meshes[0].scaling = new Vector3(.05,.05,.05);
        this._arrowMesh = arrow.meshes[0];
        const material = new StandardMaterial('arrowMaterial', scene);
        material.emissiveColor = Color3.White();
        this._arrowMesh.material = material;
        window.setInterval(() => {
            const point = scene.getMeshById('endBase');
            point.computeWorldMatrix(true)
            this._arrowMesh.position = this._radarTransform.absolutePosition;
            this._arrowMesh.lookAt(point.absolutePosition);
        }, 100);

       // arrow[0].parent = this._radarTransform;
        /*window.setInterval(() => {
            scene.meshes.forEach((mesh) => {
                if (mesh.physicsBody) {
                    if (!this._radarMeshes.has(mesh.id)) {
                        const radarmesh = new InstancedMesh('radar-' + mesh.id, mesh as Mesh);
                        radarmesh.metadata = {source: mesh};
                        radarmesh.parent = this._radarTransform;
                        this._radarMeshes.set(mesh.id, radarmesh);
                    }
                    this.update();
                }
            });
        }, 2000);

         */
    }

    private async update() {
        /*this._radarMeshes.forEach((radarMesh, id) => {
            const mesh = radarMesh.metadata.source as AbstractMesh;
            radarMesh.position = mesh.absolutePosition.subtract(this._shipTransform.absolutePosition).scaleInPlace(1.1);
        });

         */
    }
}