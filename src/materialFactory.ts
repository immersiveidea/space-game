import {
    Color3,
    DynamicTexture,
    NoiseProceduralTexture,
    PBRMaterial,
    Scene,
    StandardMaterial,
    Texture,
    Vector3
} from "@babylonjs/core";
import { TextureLevel } from "./gameConfig";
import { FireProceduralTexture } from "@babylonjs/procedural-textures";
import { createSphereLightmap } from "./sphereLightmap";

/**
 * Factory for creating materials at different quality levels
 */
export class MaterialFactory {
    /**
     * Create a planet material based on texture level
     */
    public static createPlanetMaterial(
        name: string,
        texturePath: string,
        textureLevel: TextureLevel,
        scene: Scene,
        sunDirection: Vector3
    ): StandardMaterial | PBRMaterial {
        switch (textureLevel) {
            case TextureLevel.WIREFRAME:
                return this.createWireframeMaterial(name, scene, new Color3(0.5, 0.5, 0.8));

            case TextureLevel.SIMPLE_MATERIAL:
                return this.createSimplePlanetMaterial(name, scene);

            case TextureLevel.FULL_TEXTURE:
                return this.createFullTexturePlanetMaterial(name, texturePath, scene, sunDirection);

            case TextureLevel.PBR_TEXTURE:
                return this.createPBRPlanetMaterial(name, texturePath, scene, sunDirection);

            default:
                return this.createFullTexturePlanetMaterial(name, texturePath, scene, sunDirection);
        }
    }

    /**
     * Create an asteroid material based on texture level
     */
    public static createAsteroidMaterial(
        name: string,
        textureLevel: TextureLevel,
        scene: Scene,
        originalMaterial?: PBRMaterial
    ): StandardMaterial | PBRMaterial {
        switch (textureLevel) {
            case TextureLevel.WIREFRAME:
                return this.createWireframeMaterial(name, scene, new Color3(0.5, 0.5, 0.5));

            case TextureLevel.SIMPLE_MATERIAL:
                return this.createSimpleAsteroidMaterial(name, scene);

            case TextureLevel.FULL_TEXTURE:
                return this.createFullTextureAsteroidMaterial(name, scene, originalMaterial);

            case TextureLevel.PBR_TEXTURE:
                return this.createPBRAsteroidMaterial(name, scene, originalMaterial);

            default:
                return this.createFullTextureAsteroidMaterial(name, scene, originalMaterial);
        }
    }

    /**
     * Create a sun material based on texture level
     */
    public static createSunMaterial(
        name: string,
        textureLevel: TextureLevel,
        scene: Scene
    ): StandardMaterial | PBRMaterial {
        switch (textureLevel) {
            case TextureLevel.WIREFRAME:
                return this.createWireframeMaterial(name, scene, new Color3(1, 1, 0));

            case TextureLevel.SIMPLE_MATERIAL:
                return this.createSimpleSunMaterial(name, scene);

            case TextureLevel.FULL_TEXTURE:
                return this.createFullTextureSunMaterial(name, scene);

            case TextureLevel.PBR_TEXTURE:
                return this.createPBRSunMaterial(name, scene);

            default:
                return this.createFullTextureSunMaterial(name, scene);
        }
    }

    // ========== Private helper methods ==========

    /**
     * Create wireframe material
     */
    private static createWireframeMaterial(
        name: string,
        scene: Scene,
        color: Color3
    ): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        material.wireframe = true;
        material.emissiveColor = color;
        material.disableLighting = true;
        return material;
    }

    /**
     * Create simple planet material with solid color
     */
    private static createSimplePlanetMaterial(name: string, scene: Scene): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        material.diffuseColor = new Color3(0.4, 0.6, 0.8);
        material.specularColor = Color3.Black();
        return material;
    }

    /**
     * Create full texture planet material (current implementation)
     */
    private static createFullTexturePlanetMaterial(
        name: string,
        texturePath: string,
        scene: Scene,
        sunDirection: Vector3
    ): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        const texture = new Texture(texturePath, scene);

        // Create lightmap with bright light pointing toward sun
        const lightmap = createSphereLightmap(
            name + "-lightmap",
            256,
            scene,
            sunDirection,
            1,
            sunDirection.negate(),
            0.3,
            0.3
        );

        material.emissiveTexture = texture;
        material.lightmapTexture = lightmap;
        material.useLightmapAsShadowmap = true;
        material.disableLighting = true;
        material.roughness = 1;
        material.specularColor = Color3.Black();

        return material;
    }

    /**
     * Create PBR planet material
     */
    private static createPBRPlanetMaterial(
        name: string,
        texturePath: string,
        scene: Scene,
        sunDirection: Vector3
    ): PBRMaterial {
        const material = new PBRMaterial(name, scene);
        const texture = new Texture(texturePath, scene);

        // Create lightmap with bright light pointing toward sun
        const lightmap = createSphereLightmap(
            name + "-lightmap",
            256,
            scene,
            sunDirection,
            1,
            sunDirection.negate(),
            0.3,
            0.3
        );

        material.albedoTexture = texture;
        material.lightmapTexture = lightmap;
        material.useLightmapAsShadowmap = true;
        material.roughness = 0.8;
        material.metallic = 0;

        return material;
    }

    /**
     * Create simple asteroid material with solid color
     */
    private static createSimpleAsteroidMaterial(name: string, scene: Scene): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        material.diffuseColor = new Color3(0.4, 0.4, 0.4);
        material.specularColor = Color3.Black();
        return material;
    }

    /**
     * Create full texture asteroid material (current implementation)
     */
    private static createFullTextureAsteroidMaterial(name: string, scene: Scene, originalMaterial?: PBRMaterial): StandardMaterial {
        // If we have the original material from GLB, use it as a base
        if (originalMaterial) {
            // Clone the original material to preserve bump texture and other properties
            const material = originalMaterial.clone(name) as PBRMaterial;

            // Create noise texture for color variation
            const noiseTexture = new NoiseProceduralTexture(name + "-noise", 256, scene);
            noiseTexture.brightness = 0.6;
            noiseTexture.octaves = 4;

            // Replace only the albedo texture, keeping bump and other textures
            material.albedoTexture = noiseTexture;
            material.roughness = 1;

            return material as any as StandardMaterial;
        }

        // Fallback if no original material
        const material = new StandardMaterial(name, scene);
        const noiseTexture = new NoiseProceduralTexture(name + "-noise", 256, scene);
        noiseTexture.brightness = 0.6;
        noiseTexture.octaves = 4;

        material.ambientTexture = noiseTexture;
        material.diffuseTexture = noiseTexture;
        material.roughness = 1;

        return material;
    }

    /**
     * Create PBR asteroid material
     */
    private static createPBRAsteroidMaterial(name: string, scene: Scene, originalMaterial?: PBRMaterial): PBRMaterial {
        // If we have the original material from GLB, use it as a base
        if (originalMaterial) {
            // Clone the original material to preserve bump texture and other properties
            const material = originalMaterial.clone(name) as PBRMaterial;

            // Create noise texture for color variation
            const noiseTexture = new NoiseProceduralTexture(name + "-noise", 256, scene);
            noiseTexture.brightness = 0.6;
            noiseTexture.octaves = 4;

            // Replace only the albedo texture, keeping bump and other textures
            material.albedoTexture = noiseTexture;
            material.roughness = 1;
            material.metallic = 0;

            return material;
        }

        // Fallback if no original material
        const material = new PBRMaterial(name, scene);
        const noiseTexture = new NoiseProceduralTexture(name + "-noise", 256, scene);
        noiseTexture.brightness = 0.6;
        noiseTexture.octaves = 4;

        material.albedoTexture = noiseTexture;
        material.roughness = 1;
        material.metallic = 0;

        return material;
    }

    /**
     * Create simple sun material with solid color
     */
    private static createSimpleSunMaterial(name: string, scene: Scene): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        material.emissiveColor = new Color3(1, 0.9, 0.2);
        material.disableLighting = true;
        return material;
    }

    /**
     * Create full texture sun material (current implementation)
     */
    private static createFullTextureSunMaterial(name: string, scene: Scene): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        material.emissiveTexture = new FireProceduralTexture("fire", 1024, scene);
        material.emissiveColor = new Color3(0.5, 0.5, 0.1);
        material.disableLighting = true;
        return material;
    }

    /**
     * Create PBR sun material
     */
    private static createPBRSunMaterial(name: string, scene: Scene): PBRMaterial {
        const material = new PBRMaterial(name, scene);
        material.emissiveTexture = new FireProceduralTexture("fire", 1024, scene);
        material.emissiveColor = new Color3(0.5, 0.5, 0.1);
        material.unlit = true;
        return material;
    }
}
