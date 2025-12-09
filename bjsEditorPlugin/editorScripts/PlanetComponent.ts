/**
 * BabylonJS Editor script component for planets
 * Copy this to your Editor workspace: src/scenes/scripts/PlanetComponent.ts
 *
 * Attach to a mesh to configure planet properties.
 */
import { Mesh } from "@babylonjs/core/Meshes/mesh";

import { visibleAsNumber, visibleAsString } from "babylonjs-editor-tools";

export default class PlanetComponent extends Mesh {
    @visibleAsNumber("Diameter", { min: 10, max: 1000, step: 10 })
    public diameter: number = 100;

    @visibleAsString("Texture Path", { description: "Path to planet texture" })
    public texturePath: string = "";
}
