/**
 * Builds StartBaseConfig from mesh with BaseComponent
 */
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { StartBaseConfig, Vector3Array } from "../types";
import { getScriptValues } from "../scriptUtils";

export function buildBaseConfig(mesh: AbstractMesh | null): StartBaseConfig | undefined {
    if (!mesh) {
        return undefined;
    }

    const script = getScriptValues(mesh);
    const glbPath = extractGlbPath(mesh, script);
    const rotation = toVector3Array(mesh.rotation);
    const hasRotation = rotation[0] !== 0 || rotation[1] !== 0 || rotation[2] !== 0;

    return {
        position: toVector3Array(mesh.position),
        rotation: hasRotation ? rotation : undefined,
        baseGlbPath: glbPath || undefined,
        landingGlbPath: (script.landingGlbPath as string) || undefined,
    };
}

function extractGlbPath(mesh: AbstractMesh, script: Record<string, unknown>): string | null {
    // 1. Check script property first (manual override)
    if (script.baseGlbPath) return script.baseGlbPath as string;

    // 2. Check mesh metadata for source file path
    const meta = mesh.metadata as Record<string, any> | undefined;
    if (meta?.sourcePath) return extractFilename(meta.sourcePath);
    if (meta?.gltf?.sourcePath) return extractFilename(meta.gltf.sourcePath);

    // 3. Derive from mesh name if it looks like a GLB reference
    const name = mesh.name || "";
    if (name.endsWith(".glb") || name.endsWith(".gltf")) return name;

    // 4. Check if name contains path separator and extract filename
    if (name.includes("/")) return extractFilename(name);

    return null;
}

function extractFilename(path: string): string {
    return path.split("/").pop() || path;
}

function toVector3Array(v: { x: number; y: number; z: number }): Vector3Array {
    return [v.x, v.y, v.z];
}
