/**
 * Imports LevelConfig into the editor scene
 * Updates existing GLB meshes and creates asteroid instances
 */
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { LevelConfig, AsteroidConfig } from "./types";

const SCRIPTS = {
    asteroid: "scripts/editorScripts/AsteroidComponent.ts",
    ship: "scripts/editorScripts/ShipComponent.ts",
};

export function importLevelConfig(scene: Scene, config: LevelConfig, onComplete?: () => void): void {
    updateShip(scene, config);
    updateBase(scene, config);
    updateAsteroids(scene, config);
    onComplete?.();
}

function updateShip(scene: Scene, config: LevelConfig): void {
    const ship = findMeshByName(scene, "ship.glb") || findMeshByName(scene, "Ship");
    if (!ship) { console.warn("Ship mesh not found"); return; }
    ship.position = new Vector3(...config.ship.position);
    if (config.ship.rotation) ship.rotation = new Vector3(...config.ship.rotation);
}

function updateBase(scene: Scene, config: LevelConfig): void {
    if (!config.startBase) return;
    const base = findMeshByName(scene, "base.glb");
    if (!base) { console.warn("Base mesh not found"); return; }
    if (config.startBase.position) base.position = new Vector3(...config.startBase.position);
    if (config.startBase.rotation) base.rotation = new Vector3(...config.startBase.rotation);
}

function updateAsteroids(scene: Scene, config: LevelConfig): void {
    const asteroidSource = findAsteroidSource(scene);
    if (!asteroidSource) { console.warn("Asteroid source mesh not found"); return; }
    clearAsteroidInstances(scene);
    config.asteroids.forEach((a) => createAsteroidInstance(asteroidSource, a));
}

function findMeshByName(scene: Scene, name: string): Mesh | null {
    return scene.meshes.find((m) => m.name === name) as Mesh | null;
}

function findAsteroidSource(scene: Scene): Mesh | null {
    // Find the Asteroid mesh (not instances) - it's a child of asteroid.glb
    const asteroidMesh = scene.meshes.find((m) =>
        m.name === "Asteroid" && !(m instanceof InstancedMesh)
    );
    return asteroidMesh as Mesh | null;
}

function clearAsteroidInstances(scene: Scene): void {
    // Clear all instances that have AsteroidComponent script attached
    const instances = scene.meshes.filter((m) =>
        m instanceof InstancedMesh && m.metadata?.scripts?.[0]?.key === SCRIPTS.asteroid
    );
    instances.forEach((inst) => inst.dispose());
}

function createAsteroidInstance(source: Mesh, a: AsteroidConfig): void {
    const instance = source.createInstance(a.id);
    instance.position = new Vector3(...a.position);
    if (a.rotation) instance.rotation = new Vector3(...a.rotation);
    instance.scaling = new Vector3(a.scale, a.scale, a.scale);
    instance.metadata = {
        scripts: [{
            key: SCRIPTS.asteroid, enabled: true,
            values: {
                linearVelocity: { type: "vector3", value: a.linearVelocity },
                angularVelocity: { type: "vector3", value: a.angularVelocity ?? [0, 0, 0] },
                mass: { type: "number", value: a.mass ?? 200 },
                targetId: { type: "string", value: a.targetId ?? "" },
                targetMode: { type: "string", value: a.targetMode ?? "" },
            },
        }],
    };
}
