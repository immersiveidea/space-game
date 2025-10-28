import {
    AbstractMesh,
    Color3, GlowLayer,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    PointLight,
    StandardMaterial, Texture,
    Vector3
} from "@babylonjs/core";
import {DefaultScene} from "./defaultScene";
import {FireProceduralTexture} from "@babylonjs/procedural-textures";

export function createSun() : AbstractMesh {
    const light = new PointLight("light", new Vector3(0, 0, 400), DefaultScene.MainScene);
    light.intensity = 100;
    const sun = MeshBuilder.CreateSphere("sun", {diameter: 50, segments: 32}, DefaultScene.MainScene);

    //const sunAggregate = new PhysicsAggregate(sun, PhysicsShapeType.SPHERE, {mass: 0}, DefaultScene.MainScene);
    //sunAggregate.body.setMotionType(PhysicsMotionType.STATIC);
    const material = new StandardMaterial("material", DefaultScene.MainScene);
    material.emissiveTexture =new FireProceduralTexture("fire", 512, DefaultScene.MainScene);
    material.emissiveColor = new Color3(.5, .5, .1);
    material.disableLighting = true;
    sun.material = material;
    const gl = new GlowLayer("glow", DefaultScene.MainScene);
    //gl.addIncludedOnlyMesh(sun);
    gl.intensity = 1;

    sun.position = new Vector3(0, 0, 400);
    return sun;
}

export function createPlanet(position: Vector3, diameter: number, name: string) : AbstractMesh {
    const planet = MeshBuilder.CreateSphere(name, {diameter: diameter, segments: 32}, DefaultScene.MainScene);
    const material = new StandardMaterial(name + "-material", DefaultScene.MainScene);
    const texture = new Texture("/planetTextures/Arid/Arid_01-512x512.png", DefaultScene.MainScene);
    material.diffuseTexture = texture;
    material.ambientTexture = texture;
    material.roughness = 1;
    material.specularColor = Color3.Black();
    //material.diffuseColor = new Color3(Math.random(), Math.random(), Math.random());
    planet.material = material;
    planet.position = position;
    return planet;
}