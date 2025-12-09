/**
 * Builds ShipConfig from mesh with ShipComponent
 */
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { ShipConfig, Vector3Array } from "../types";
import { getScriptValues } from "../scriptUtils";

export function buildShipConfig(mesh: AbstractMesh | null): ShipConfig {
    if (!mesh) {
        return { position: [0, 1, 0] };
    }

    const script = getScriptValues(mesh);

    return {
        position: toVector3Array(mesh.position),
        rotation: mesh.rotation ? toVector3Array(mesh.rotation) : undefined,
        linearVelocity: extractVector3OrUndefined(script.linearVelocity),
        angularVelocity: extractVector3OrUndefined(script.angularVelocity)
    };
}

function toVector3Array(v: { x: number; y: number; z: number }): Vector3Array {
    return [v.x, v.y, v.z];
}

function extractVector3OrUndefined(v: unknown): Vector3Array | undefined {
    if (!v) return undefined;
    if (Array.isArray(v)) {
        const arr = v as number[];
        if (arr[0] === 0 && arr[1] === 0 && arr[2] === 0) return undefined;
        return arr as Vector3Array;
    }
    const vec = v as { x?: number; y?: number; z?: number };
    const arr: Vector3Array = [vec.x ?? 0, vec.y ?? 0, vec.z ?? 0];
    if (arr[0] === 0 && arr[1] === 0 && arr[2] === 0) return undefined;
    return arr;
}
