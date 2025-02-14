import {
    AbstractMesh, Color3, GlowLayer,
    MeshBuilder,
    ParticleSystem,
    StandardMaterial,
    Texture,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";

type MainEngine = {
    transformNode: TransformNode;
    particleSystem: ParticleSystem;
}
export class ShipEngine {
    private _ship: TransformNode;
    private _leftMainEngine: MainEngine;
    private _rightMainEngine: MainEngine;
    private _gl: GlowLayer;
    constructor(ship: TransformNode) {
        this._ship = ship;
        this.initialize();
    }

    private initialize() {
        this._gl = new GlowLayer("glow", DefaultScene.MainScene);
        this._gl.intensity =1;
        this._leftMainEngine = this.createEngine(new Vector3(-.44, .37, -1.1));
        this._rightMainEngine = this.createEngine(new Vector3(.44, .37, -1.1));
    }
    public idle() {
        this._leftMainEngine.particleSystem.emitRate = 1;
        this._rightMainEngine.particleSystem.emitRate = 1;
    }
    public forwardback(value: number) {

        if (Math.sign(value) > 0) {
            (this._leftMainEngine.particleSystem.emitter as AbstractMesh).rotation.y = 0;
            (this._rightMainEngine.particleSystem.emitter as AbstractMesh).rotation.y = 0;
        } else {
            (this._leftMainEngine.particleSystem.emitter as AbstractMesh).rotation.y = Math.PI;
            (this._rightMainEngine.particleSystem.emitter as AbstractMesh).rotation.y = Math.PI;
        }
        this._leftMainEngine.particleSystem.emitRate = Math.abs(value) * 10;
        this._rightMainEngine.particleSystem.emitRate = Math.abs(value) * 10;
    }

    private createEngine(position: Vector3) : MainEngine{
        const MAIN_ROTATION = Math.PI / 2;
        const engine = new TransformNode("engine", DefaultScene.MainScene);
        engine.parent = this._ship;
        engine.position = position;
        const leftDisc = MeshBuilder.CreateIcoSphere("engineSphere", {radius: .07}, DefaultScene.MainScene);
        this._gl.addIncludedOnlyMesh(leftDisc);
        const material = new StandardMaterial("material", DefaultScene.MainScene);
        material.emissiveColor = new Color3(.5, .5, .1);
        leftDisc.material = material;
        leftDisc.parent = engine;
        leftDisc.rotation.x = MAIN_ROTATION;
        const particleSystem = this.createParticleSystem(leftDisc);
        return {transformNode: engine, particleSystem: particleSystem};
    }
    private createParticleSystem(mesh: AbstractMesh): ParticleSystem {
            const myParticleSystem = new ParticleSystem("particles", 1000, DefaultScene.MainScene);
            myParticleSystem.emitRate = 1;
            //myParticleSystem.minEmitPower = 2;
            //myParticleSystem.maxEmitPower = 10;

            myParticleSystem.particleTexture = new Texture("./flare.png");
            myParticleSystem.emitter = mesh;
            const coneEmitter = myParticleSystem.createConeEmitter(0.1, Math.PI / 9);
            myParticleSystem.addSizeGradient(0, .01);
            myParticleSystem.addSizeGradient(1, .3);
            myParticleSystem.isLocal = true;

            myParticleSystem.start(); //S
            return myParticleSystem;

    }
}