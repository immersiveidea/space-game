/**
 * Collects meshes from scene grouped by their attached component type
 */
import { Scene } from "@babylonjs/core/scene";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { getScriptName } from "./scriptUtils";

export interface CollectedMeshes {
    asteroids: AbstractMesh[];
    planets: AbstractMesh[];
    ship: AbstractMesh | null;
    sun: AbstractMesh | null;
    base: AbstractMesh | null;
    targets: TransformNode[];
}

export function collectMeshesByComponent(scene: Scene): CollectedMeshes {
    const result: CollectedMeshes = {
        asteroids: [],
        planets: [],
        ship: null,
        sun: null,
        base: null,
        targets: []
    };

    for (const mesh of scene.meshes) {
        const scriptName = getScriptName(mesh);
        categorizeByScript(scriptName, mesh, result);
    }

    collectTargetNodes(scene, result);
    return result;
}

function categorizeByScript(
    scriptName: string | null,
    mesh: AbstractMesh,
    result: CollectedMeshes
): void {
    switch (scriptName) {
        case "AsteroidComponent":
            result.asteroids.push(mesh);
            break;
        case "PlanetComponent":
            result.planets.push(mesh);
            break;
        case "ShipComponent":
            result.ship = mesh;
            break;
        case "SunComponent":
            result.sun = mesh;
            break;
        case "BaseComponent":
            result.base = mesh;
            break;
    }
}

function collectTargetNodes(scene: Scene, result: CollectedMeshes): void {
    for (const node of scene.transformNodes) {
        if (getScriptName(node) === "TargetComponent") {
            result.targets.push(node);
        }
    }
}

