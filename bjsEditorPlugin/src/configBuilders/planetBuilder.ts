/**
 * Builds PlanetConfig[] from meshes with PlanetComponent
 */
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PlanetConfig, Vector3Array } from "../types";
import { getScriptValues } from "../scriptUtils";

export function buildPlanetConfigs(meshes: AbstractMesh[]): PlanetConfig[] {
    return meshes.map(buildSinglePlanet);
}

function buildSinglePlanet(mesh: AbstractMesh): PlanetConfig {
    const script = getScriptValues(mesh);

    return {
        name: mesh.name || "planet",
        position: toVector3Array(mesh.position),
        diameter: (script.diameter as number) ?? 100,
        texturePath: (script.texturePath as string) || "planet_texture.jpg",
        rotation: hasRotation(mesh) ? toVector3Array(mesh.rotation) : undefined
    };
}

function toVector3Array(v: { x: number; y: number; z: number }): Vector3Array {
    return [v.x, v.y, v.z];
}

function hasRotation(mesh: AbstractMesh): boolean {
    const r = mesh.rotation;
    return r.x !== 0 || r.y !== 0 || r.z !== 0;
}
