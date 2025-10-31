import {
    AbstractMesh, Color3,
    MeshBuilder,
    StandardMaterial,
    Texture,
    Vector3
} from "@babylonjs/core";
import { DefaultScene } from "./defaultScene";
import { getRandomPlanetTexture } from "./planetTextures";
import debugLog from './debug';

/**
 * Creates multiple planets with random textures, sizes, and positions
 * @param count - Number of planets to create
 * @param sunPosition - Position of the sun (center point for planet orbit distances)
 * @param minDiameter - Minimum planet diameter (default: 50)
 * @param maxDiameter - Maximum planet diameter (default: 100)
 * @param minDistance - Minimum distance from sun (default: 400)
 * @param maxDistance - Maximum distance from sun (default: 1000)
 * @returns Array of created planet meshes
 */
export function createPlanets(
    count: number,
    sunPosition: Vector3 = Vector3.Zero(),
    minDiameter: number = 100,
    maxDiameter: number = 200,
    minDistance: number = 500,
    maxDistance: number = 1000
): AbstractMesh[] {
    const planets: AbstractMesh[] = [];

    for (let i = 0; i < count; i++) {
        // Random diameter between min and max
        const diameter = minDiameter + Math.random() * (maxDiameter - minDiameter);

        // Create sphere
        const planet = MeshBuilder.CreateSphere(
            `planet-${i}`,
            { diameter: diameter, segments: 32 },
            DefaultScene.MainScene
        );

        // Random distance from sun
        const distance = minDistance + Math.random() * (maxDistance - minDistance);

        // Random position on a sphere around the sun
        const theta = Math.random() * Math.PI * 2; // Random angle around Y axis
        const phi = Math.random() * Math.PI;        // Random angle from Y axis

        // Convert spherical coordinates to Cartesian
        const x = distance * Math.sin(phi) * Math.cos(theta);
        const y = distance * Math.sin(phi) * Math.sin(theta);
        const z = distance * Math.cos(phi);

        planet.position = new Vector3(
            sunPosition.x + x,
            sunPosition.y + y,
            sunPosition.z + z
        );

        // Apply random planet texture
        const material = new StandardMaterial(`planet-material-${i}`, DefaultScene.MainScene);
        const texture  = new Texture(getRandomPlanetTexture(), DefaultScene.MainScene);
        material.diffuseTexture = texture;
        material.ambientTexture = texture;

        planets.push(planet);
    }

    debugLog(`Created ${count} planets with diameters ${minDiameter}-${maxDiameter} at distances ${minDistance}-${maxDistance}`);
    return planets;
}

/**
 * Creates planets in a more organized orbital pattern (flat solar system style)
 * @param count - Number of planets to create
 * @param sunPosition - Position of the sun
 * @param minDiameter - Minimum planet diameter (default: 50)
 * @param maxDiameter - Maximum planet diameter (default: 100)
 * @param minDistance - Minimum distance from sun (default: 400)
 * @param maxDistance - Maximum distance from sun (default: 1000)
 * @returns Array of created planet meshes
 */
export function createPlanetsOrbital(
    count: number,
    sunPosition: Vector3 = Vector3.Zero(),
    minDiameter: number = 50,
    maxDiameter: number = 100,
    minDistance: number = 400,
    maxDistance: number = 1000
): AbstractMesh[] {
    const planets: AbstractMesh[] = [];

    for (let i = 0; i < count; i++) {
        // Random diameter between min and max
        const diameter = minDiameter + Math.random() * (maxDiameter - minDiameter);

        // Create sphere
        const planet = MeshBuilder.CreateSphere(
            `planet-${i}`,
            { diameter: diameter, segments: 32 },
            DefaultScene.MainScene
        );

        // Random distance from sun
        const distance = minDistance + Math.random() * (maxDistance - minDistance);

        // Random angle around Y axis (orbital plane)
        const angle = Math.random() * Math.PI * 2;

        // Keep planets mostly in a plane (like a solar system)
        const y = (Math.random() - 0.5) * 100; // Small vertical variation

        planet.position = new Vector3(
            sunPosition.x + distance * Math.cos(angle),
            sunPosition.y + y,
            sunPosition.z + distance * Math.sin(angle)
        );

        // Apply random planet texture
        const material = new StandardMaterial(`planet-material-${i}`, DefaultScene.MainScene);
        const texture  = new Texture(getRandomPlanetTexture(), DefaultScene.MainScene);
        material.diffuseTexture = texture;
        material.ambientTexture = texture;

        planet.material = material;
        material.specularColor = Color3.Black()

        planets.push(planet);
    }

    debugLog(`Created ${count} planets in orbital pattern with diameters ${minDiameter}-${maxDiameter} at distances ${minDistance}-${maxDistance}`);
    return planets;
}
