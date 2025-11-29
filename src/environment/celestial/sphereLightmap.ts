import { DynamicTexture, Scene, Vector3 } from "@babylonjs/core";

/**
 * Generate a lightmap texture for a sphere with two directional lights
 * @param name - Texture name
 * @param size - Texture resolution (e.g., 512, 1024)
 * @param scene - Babylon scene
 * @param brightLightDir - Direction of bright light (will be normalized)
 * @param brightIntensity - Intensity of bright light (0-1)
 * @param dimLightDir - Direction of dim light (will be normalized)
 * @param dimIntensity - Intensity of dim light (0-1)
 * @param ambientIntensity - Base ambient light (0-1)
 * @returns DynamicTexture with baked lighting
 */
export function createSphereLightmap(
    name: string,
    size: number,
    scene: Scene,
    brightLightDir: Vector3 = new Vector3(1, 0, 0),
    brightIntensity: number = 1.0,
    dimLightDir: Vector3 = new Vector3(-1, 0, 0),
    dimIntensity: number = 0.2,
    ambientIntensity: number = 0.1
): DynamicTexture {
    const texture = new DynamicTexture(name, { width: size, height: size }, scene, false);
    const context = texture.getContext() as CanvasRenderingContext2D;
    const imageData = context.createImageData(size, size);

    // Normalize light directions
    const brightDir = brightLightDir.normalize();
    const dimDir = dimLightDir.normalize();

    // Generate lightmap
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Convert pixel coordinates to UV (0-1)
            const u = x / (size - 1);
            const v = y / (size - 1);

            // Convert UV to 3D position on unit sphere
            // Using spherical coordinates: theta (longitude), phi (latitude)
            const theta = u * Math.PI * 2; // 0 to 2π
            const phi = v * Math.PI;       // 0 to π

            // Convert spherical to Cartesian (unit sphere)
            const normal = new Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.cos(phi),
                Math.sin(phi) * Math.sin(theta)
            );

            // Calculate lighting from bright light
            // Lambertian diffuse: max(0, dot(normal, lightDir))
            const brightDot = Vector3.Dot(normal, brightDir);
            const brightLight = Math.max(0, brightDot) * brightIntensity;

            // Calculate lighting from dim light
            const dimDot = Vector3.Dot(normal, dimDir);
            const dimLight = Math.max(0, dimDot) * dimIntensity;

            // Combine all lighting
            const totalLight = ambientIntensity + brightLight + dimLight;

            // Clamp to 0-1 range
            const intensity = Math.min(1, Math.max(0, totalLight));

            // Convert to 0-255 grayscale
            const brightness = Math.floor(intensity * 255);

            // Set pixel (RGBA)
            const index = (y * size + x) * 4;
            imageData.data[index + 0] = brightness; // R
            imageData.data[index + 1] = brightness; // G
            imageData.data[index + 2] = brightness; // B
            imageData.data[index + 3] = 255;        // A (fully opaque)
        }
    }

    // Write image data to texture
    context.putImageData(imageData, 0, 0);
    texture.update();

    return texture;
}

