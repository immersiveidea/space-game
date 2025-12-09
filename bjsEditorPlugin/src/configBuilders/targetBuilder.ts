/**
 * Builds TargetConfig[] from TransformNodes with TargetComponent
 */
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { TargetConfig, Vector3Array } from "../types";
import { getScriptValues } from "../scriptUtils";

export function buildTargetConfigs(nodes: TransformNode[]): TargetConfig[] {
    return nodes.map(buildSingleTarget);
}

function buildSingleTarget(node: TransformNode): TargetConfig {
    const script = getScriptValues(node);

    return {
        id: node.name || node.id,
        name: (script.displayName as string) || node.name || "Target",
        position: toVector3Array(node.getAbsolutePosition())
    };
}

function toVector3Array(v: { x: number; y: number; z: number }): Vector3Array {
    return [v.x, v.y, v.z];
}
