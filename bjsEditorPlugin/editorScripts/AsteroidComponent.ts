/**
 * BabylonJS Editor script component for asteroids
 * Copy this to your Editor workspace: src/scenes/scripts/AsteroidComponent.ts
 *
 * Attach to asteroid meshes to expose game properties in Inspector.
 */
import { Mesh } from "@babylonjs/core/Meshes/mesh";

import {
    visibleAsNumber,
    visibleAsString,
    visibleAsVector3,
} from "babylonjs-editor-tools";

export default class AsteroidComponent extends Mesh {
    @visibleAsVector3("Linear Velocity", { step: 0.1 })
    public linearVelocity = { x: 0, y: 0, z: 0 };

    @visibleAsVector3("Angular Velocity", { step: 0.01 })
    public angularVelocity = { x: 0, y: 0, z: 0 };

    @visibleAsNumber("Mass", { min: 1, max: 1000, step: 10 })
    public mass: number = 200;

    @visibleAsString("Target ID", { description: "Reference to a TargetComponent node" })
    public targetId: string = "";

    @visibleAsString("Target Mode", { description: "orbit | moveToward | (empty)" })
    public targetMode: string = "";
}
