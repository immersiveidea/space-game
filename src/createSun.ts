import {
    AbstractMesh,
    Color3, GlowLayer,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    PointLight,
    StandardMaterial,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {FireProceduralTexture} from "@babylonjs/procedural-textures";

export function createSun() : AbstractMesh {
    const light = new PointLight("light", new Vector3(0, 0, 0), DefaultScene.MainScene);
    const sun = MeshBuilder.CreateSphere("sun", {diameter: 50, segments: 32}, DefaultScene.MainScene);

    const sunAggregate = new PhysicsAggregate(sun, PhysicsShapeType.SPHERE, {mass: 0}, DefaultScene.MainScene);
    sunAggregate.body.setMotionType(PhysicsMotionType.STATIC);
    const material = new StandardMaterial("material", DefaultScene.MainScene);
    material.emissiveTexture =new FireProceduralTexture("fire", 256, DefaultScene.MainScene);
    material.emissiveColor = new Color3(.5, .5, .1);
    material.disableLighting = true;
    sun.material = material;
    const gl = new GlowLayer("glow", DefaultScene.MainScene);
    //gl.addIncludedOnlyMesh(sun);
    gl.intensity = 5;


    sun.position = new Vector3(0, 0, 0);
    return sun;
}