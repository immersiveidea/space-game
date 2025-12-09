/**
 * BabylonJS Editor script component for orbit/movement targets
 * Copy this to your Editor workspace: src/scenes/scripts/TargetComponent.ts
 *
 * Attach to a TransformNode to create an invisible target point.
 * Asteroids can reference this by targetId to orbit or move toward.
 */
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { visibleAsString } from "babylonjs-editor-tools";

export default class TargetComponent extends TransformNode {
    @visibleAsString("Display Name", { description: "Friendly name for this target" })
    public displayName: string = "Target";
}
