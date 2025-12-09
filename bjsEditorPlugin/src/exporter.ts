/**
 * Main export orchestrator - builds LevelConfig from scene
 */
import { Scene } from "@babylonjs/core/scene";
import { LevelConfig } from "./types";
import { collectMeshesByComponent } from "./meshCollector";
import { buildAsteroidConfigs } from "./configBuilders/asteroidBuilder";
import { buildBaseConfig } from "./configBuilders/baseBuilder";
import { buildPlanetConfigs } from "./configBuilders/planetBuilder";
import { buildShipConfig } from "./configBuilders/shipBuilder";
import { buildSunConfig } from "./configBuilders/sunBuilder";
import { buildTargetConfigs } from "./configBuilders/targetBuilder";

export function exportLevelConfig(scene: Scene): string {
    const meshes = collectMeshesByComponent(scene);

    const config: LevelConfig = {
        version: "1.0",
        difficulty: "rookie",
        timestamp: new Date().toISOString(),
        metadata: {
            author: "BabylonJS Editor",
            description: "Exported from Editor"
        },
        ship: buildShipConfig(meshes.ship),
        startBase: buildBaseConfig(meshes.base),
        sun: buildSunConfig(meshes.sun),
        targets: buildTargetConfigs(meshes.targets),
        planets: buildPlanetConfigs(meshes.planets),
        asteroids: buildAsteroidConfigs(meshes.asteroids),
        useOrbitConstraints: true
    };

    return JSON.stringify(config, null, 2);
}
