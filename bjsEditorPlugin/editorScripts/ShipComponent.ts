/**
 * BabylonJS Editor script component for player ship spawn
 * Copy this to your Editor workspace: src/scenes/scripts/ShipComponent.ts
 *
 * Attach to a mesh/transform node to mark player spawn point.
 */
import { Mesh } from "@babylonjs/core/Meshes/mesh";

import { visibleAsVector3 } from "babylonjs-editor-tools";

export default class ShipComponent extends Mesh {
    @visibleAsVector3("Start Velocity", { step: 0.1 })
    public linearVelocity = { x: 0, y: 0, z: 0 };

    @visibleAsVector3("Start Angular Vel", { step: 0.01 })
    public angularVelocity = { x: 0, y: 0, z: 0 };
}
