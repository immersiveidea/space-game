/**
 * Utilities for reading BabylonJS Editor script metadata
 * Editor stores scripts in: mesh.metadata.scripts[].values[prop].value
 */
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

interface EditorScript {
    key: string;
    enabled?: boolean;
    values?: Record<string, { type?: string; value?: unknown }>;
}

type NodeWithMetadata = AbstractMesh | TransformNode;

/**
 * Extract component name from node's attached scripts
 * e.g., "scenes/scripts/AsteroidComponent.ts" -> "AsteroidComponent"
 */
export function getScriptName(node: NodeWithMetadata): string | null {
    const scripts = getScriptsArray(node);
    if (!scripts.length) return null;

    const script = scripts.find(s => s.enabled !== false);
    if (!script?.key) return null;

    const filename = script.key.split("/").pop() ?? "";
    return filename.replace(/\.(ts|tsx|js)$/, "") || null;
}

/**
 * Extract flattened property values from node's script
 * Converts { prop: { value: x } } to { prop: x }
 */
export function getScriptValues(node: NodeWithMetadata): Record<string, unknown> {
    const scripts = getScriptsArray(node);
    if (!scripts.length) return {};

    const script = scripts.find(s => s.enabled !== false);
    if (!script?.values) return {};

    const result: Record<string, unknown> = {};
    for (const [key, data] of Object.entries(script.values)) {
        result[key] = data?.value;
    }
    return result;
}

function getScriptsArray(node: NodeWithMetadata): EditorScript[] {
    const metadata = node.metadata as { scripts?: EditorScript[] } | null;
    const scripts = metadata?.scripts;
    return Array.isArray(scripts) ? scripts : [];
}
