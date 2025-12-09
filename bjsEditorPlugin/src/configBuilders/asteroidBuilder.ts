/**
 * Builds AsteroidConfig[] from meshes with AsteroidComponent
 */
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AsteroidConfig, Vector3Array } from "../types";
import { getScriptValues } from "../scriptUtils";

export function buildAsteroidConfigs(meshes: AbstractMesh[]): AsteroidConfig[] {
    return meshes.map((mesh, index) => buildSingleAsteroid(mesh, index));
}

function buildSingleAsteroid(mesh: AbstractMesh, index: number): AsteroidConfig {
    const script = getScriptValues(mesh);
    const rotation = toVector3Array(mesh.rotation);
    const hasRotation = rotation[0] !== 0 || rotation[1] !== 0 || rotation[2] !== 0;

    // Debug: compare local vs absolute position
    const localPos = mesh.position;
    const absPos = mesh.getAbsolutePosition();
    if (Math.abs(localPos.x - absPos.x) > 1 || Math.abs(localPos.y - absPos.y) > 1 || Math.abs(localPos.z - absPos.z) > 1) {
        console.warn(`[AsteroidBuilder] Position mismatch for ${mesh.name}:`,
            `local=(${localPos.x.toFixed(1)}, ${localPos.y.toFixed(1)}, ${localPos.z.toFixed(1)})`,
            `absolute=(${absPos.x.toFixed(1)}, ${absPos.y.toFixed(1)}, ${absPos.z.toFixed(1)})`,
            `parent=${mesh.parent?.name || 'none'}`);
    }

    return {
        id: mesh.name || `asteroid-${index}`,
        position: toVector3Array(mesh.getAbsolutePosition()),  // Use absolute position
        rotation: hasRotation ? rotation : undefined,
        scale: mesh.scaling.x,
        linearVelocity: extractVector3(script.linearVelocity, [0, 0, 0]),
        angularVelocity: extractVector3(script.angularVelocity, [0, 0, 0]),
        mass: (script.mass as number) ?? 200,
        targetId: (script.targetId as string) || undefined,
        targetMode: parseTargetMode(script.targetMode as string)
    };
}

function toVector3Array(v: { x: number; y: number; z: number }): Vector3Array {
    return [v.x, v.y, v.z];
}

function extractVector3(v: unknown, defaultVal: Vector3Array): Vector3Array {
    if (!v) return defaultVal;
    if (Array.isArray(v)) return v as Vector3Array;
    const vec = v as { x?: number; y?: number; z?: number };
    return [vec.x ?? 0, vec.y ?? 0, vec.z ?? 0];
}

function parseTargetMode(mode: string): 'orbit' | 'moveToward' | undefined {
    if (mode === 'orbit' || mode === 'moveToward') return mode;
    return undefined;
}
