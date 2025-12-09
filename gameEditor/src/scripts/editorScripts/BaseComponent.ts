/**
 * BabylonJS Editor script component for the start base
 * Copy this to your Editor workspace: src/scenes/scripts/BaseComponent.ts
 *
 * Attach to a mesh to mark it as the start base (yellow cylinder constraint zone).
 */
import { Mesh } from "@babylonjs/core/Meshes/mesh";

import { visibleAsString } from "babylonjs-editor-tools";

export default class BaseComponent extends Mesh {
    @visibleAsString("Base GLB Path", { description: "Path to base GLB model" })
    public baseGlbPath: string = "base.glb";

    @visibleAsString("Landing GLB Path", { description: "Path to landing zone GLB" })
    public landingGlbPath: string = "";
}
