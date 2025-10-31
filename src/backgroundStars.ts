import {Color3, Color4, PointsCloudSystem, Scene, StandardMaterial, Vector3} from "@babylonjs/core";
import debugLog from './debug';

/**
 * Configuration options for background stars
 */
export interface BackgroundStarsConfig {
    /** Number of stars to generate */
    count?: number;
    /** Radius of the sphere containing the stars */
    radius?: number;
    /** Minimum star brightness (0-1) */
    minBrightness?: number;
    /** Maximum star brightness (0-1) */
    maxBrightness?: number;
    /** Star point size */
    pointSize?: number;
    /** Star colors (will be randomly selected) */
    colors?: Color4[];
}

/**
 * Generates a spherical field of background stars using PointCloudSystem
 */
export class BackgroundStars {
    private pcs: PointsCloudSystem;
    private scene: Scene;
    private config: Required<BackgroundStarsConfig>;

    // Default configuration
    private static readonly DEFAULT_CONFIG: Required<BackgroundStarsConfig> = {
        count: 5000,
        radius: 5000,
        minBrightness: 0.3,
        maxBrightness: 1.0,
        pointSize: .1,
        colors: [
            new Color4(1, 1, 1, 1),      // White
            new Color4(1, 0.95, 0.9, 1), // Warm white
            new Color4(0.9, 0.95, 1, 1), // Cool white
            new Color4(1, 0.9, 0.8, 1),  // Yellowish
            new Color4(0.8, 0.9, 1, 1)   // Bluish
        ]
    };

    constructor(scene: Scene, config?: BackgroundStarsConfig) {
        this.scene = scene;
        this.config = { ...BackgroundStars.DEFAULT_CONFIG, ...config };
        this.createStarfield();
    }

    /**
     * Create the starfield using PointCloudSystem
     */
    private createStarfield(): void {
        // Create point cloud system
        this.pcs = new PointsCloudSystem("backgroundStars", this.config.pointSize, this.scene);

        // Function to set position and color for each particle
        const initParticle = (particle: any) => {
            // Generate random position on sphere surface with some depth variation
            const theta = Math.random() * Math.PI * 2; // Azimuth angle (0 to 2π)
            const phi = Math.acos(2 * Math.random() - 1); // Polar angle (0 to π) - uniform distribution

            // Add some randomness to radius for depth
            const radiusVariation = this.config.radius * (0.8 + Math.random() * 0.2);

            // Convert spherical coordinates to Cartesian
            particle.position = new Vector3(
                radiusVariation * Math.sin(phi) * Math.cos(theta),
                radiusVariation * Math.sin(phi) * Math.sin(theta),
                radiusVariation * Math.cos(phi)
            );

            // Random brightness
            const brightness = this.config.minBrightness +
                Math.random() * (this.config.maxBrightness - this.config.minBrightness);

            // Random color from palette
            const baseColor = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];

            // Apply brightness to color
            particle.color = new Color4(
                baseColor.r * brightness,
                baseColor.g * brightness,
                baseColor.b * brightness,
                1
            );
        };

        // Add particles to the system
        this.pcs.addPoints(this.config.count, initParticle);

        // Build the mesh
        this.pcs.buildMeshAsync().then(() => {
            const mesh = this.pcs.mesh;
            if (mesh) {
                // Stars should not receive lighting
                const mat = (mesh.material as StandardMaterial)
                mat.disableLighting = true;
                mat.emissiveColor = new Color3(1,1,1);

                // Disable depth write so stars don't occlude other objects
                mat.disableDepthWrite = true;

                // Stars should be in the background
                // mesh.renderingGroupId = 0;

                // Make stars always render behind everything else
                mesh.isPickable = false;

                debugLog(`Created ${this.config.count} background stars`);
            }
        });
    }

    /**
     * Update star positions to follow camera (keeps stars at infinite distance)
     */
    public followCamera(cameraPosition: Vector3): void {
        if (this.pcs.mesh) {
            this.pcs.mesh.position = cameraPosition;
        }
    }

    /**
     * Dispose of the starfield
     */
    public dispose(): void {
        if (this.pcs) {
            this.pcs.dispose();
        }
    }

    /**
     * Get the point cloud system
     */
    public getPointCloudSystem(): PointsCloudSystem {
        return this.pcs;
    }

    /**
     * Get the mesh
     */
    public getMesh() {
        return this.pcs?.mesh;
    }

    /**
     * Set the visibility of the stars
     */
    public setVisible(visible: boolean): void {
        if (this.pcs?.mesh) {
            this.pcs.mesh.isVisible = visible;
        }
    }
}
