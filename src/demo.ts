import {DefaultScene} from "./defaultScene";
import {ArcRotateCamera, MeshBuilder, PointerEventTypes, Vector3} from "@babylonjs/core";
import {Main} from "./main";

export default class Demo {
    private _main: Main;
    constructor(main: Main) {
        this._main = main;
        this.initialize();
    }
    private async initialize() {
        if (!DefaultScene.DemoScene) {
            return;
        }
        const scene = DefaultScene.DemoScene;
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5, new Vector3(0, 0, 0), scene);
    }
}