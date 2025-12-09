/**
 * Builds SunConfig from mesh with SunComponent
 */
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { SunConfig, Vector3Array } from "../types";
import { getScriptValues } from "../scriptUtils";

const DEFAULT_SUN: SunConfig = {
    position: [0, 0, 400],
    diameter: 50
};

export function buildSunConfig(mesh: AbstractMesh | null): SunConfig {
    if (!mesh) {
        return DEFAULT_SUN;
    }

    const script = getScriptValues(mesh);

    const rotation = toVector3Array(mesh.rotation);
    const hasRotation = rotation[0] !== 0 || rotation[1] !== 0 || rotation[2] !== 0;

    return {
        position: toVector3Array(mesh.getAbsolutePosition()),
        rotation: hasRotation ? rotation : undefined,
        diameter: (script.diameter as number) ?? 50,
        intensity: (script.intensity as number) ?? 1000000,
        scale: hasNonUniformScale(mesh) ? toVector3Array(mesh.scaling) : undefined
    };
}

function toVector3Array(v: { x: number; y: number; z: number }): Vector3Array {
    return [v.x, v.y, v.z];
}

function hasNonUniformScale(mesh: AbstractMesh): boolean {
    const s = mesh.scaling;
    return s.x !== s.y || s.y !== s.z;
}
