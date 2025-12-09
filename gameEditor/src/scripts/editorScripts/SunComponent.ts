/**
 * BabylonJS Editor script component for the sun
 * Copy this to your Editor workspace: src/scenes/scripts/SunComponent.ts
 *
 * Attach to a mesh to mark it as the sun. Position from transform.
 */
import { Mesh } from "@babylonjs/core/Meshes/mesh";

import { visibleAsNumber } from "babylonjs-editor-tools";

export default class SunComponent extends Mesh {
    @visibleAsNumber("Diameter", { min: 10, max: 200, step: 5 })
    public diameter: number = 50;

    @visibleAsNumber("Intensity", { min: 0, max: 5000000, step: 100000 })
    public intensity: number = 1000000;
}
