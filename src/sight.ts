
import {
    Color3,
    Mesh,
    MeshBuilder,
    Scene,
    StandardMaterial,
    TransformNode,
    Vector3
} from "@babylonjs/core";

/**
 * Configuration options for the sight reticle
 */
export interface SightConfig {
    /** Position relative to parent */
    position?: Vector3;
    /** Circle radius */
    circleRadius?: number;
    /** Crosshair line length */
    crosshairLength?: number;
    /** Line thickness */
    lineThickness?: number;
    /** Reticle color */
    color?: Color3;
    /** Rendering group ID */
    renderingGroupId?: number;
    /** Gap size in the center of the crosshair */
    centerGap?: number;
}

/**
 * Gun sight reticle with crosshair and circle
 */
export class Sight {
    private reticleGroup: TransformNode;
    private circle: Mesh;
    private crosshairLines: Mesh[] = [];
    private scene: Scene;
    private config: Required<SightConfig>;

    // Default configuration
    private static readonly DEFAULT_CONFIG: Required<SightConfig> = {
        position: new Vector3(0, 2, 125),
        circleRadius: 2,
        crosshairLength: 1.5,
        lineThickness: 0.1,
        color: Color3.Green(),
        renderingGroupId: 3,
        centerGap: 0.5
    };

    constructor(scene: Scene, parent: TransformNode, config?: SightConfig) {
        this.scene = scene;
        this.config = { ...Sight.DEFAULT_CONFIG, ...config };
        this.createReticle(parent);
    }

    /**
     * Create the reticle (circle + crosshair)
     */
    private createReticle(parent: TransformNode): void {
        // Create a parent node for the entire reticle
        this.reticleGroup = new TransformNode("sightReticle", this.scene);
        this.reticleGroup.parent = parent;
        this.reticleGroup.position = this.config.position;

        // Create material
        const material = new StandardMaterial("sightMaterial", this.scene);
        material.emissiveColor = this.config.color;
        material.disableLighting = true;
        material.alpha = 0.8;

        // Create outer circle
        this.circle = MeshBuilder.CreateTorus("sightCircle", {
            diameter: this.config.circleRadius * 2,
            thickness: this.config.lineThickness,
            tessellation: 64
        }, this.scene);
        this.circle.parent = this.reticleGroup;
        this.circle.material = material;
        // this.circle.renderingGroupId = this.config.renderingGroupId;

        // Create crosshair lines (4 lines extending from center gap)
        this.createCrosshairLines(material);
    }

    /**
     * Create the crosshair lines (top, bottom, left, right)
     */
    private createCrosshairLines(material: StandardMaterial): void {
        const gap = this.config.centerGap;
        const length = this.config.crosshairLength;
        const thickness = this.config.lineThickness;

        // Top line
        const topLine = MeshBuilder.CreateBox("crosshairTop", {
            width: thickness,
            height: length,
            depth: thickness
        }, this.scene);
        topLine.parent = this.reticleGroup;
        topLine.position.y = gap + length / 2;
        topLine.material = material;
        // topLine.renderingGroupId = this.config.renderingGroupId;
        this.crosshairLines.push(topLine);

        // Bottom line
        const bottomLine = MeshBuilder.CreateBox("crosshairBottom", {
            width: thickness,
            height: length,
            depth: thickness
        }, this.scene);
        bottomLine.parent = this.reticleGroup;
        bottomLine.position.y = -(gap + length / 2);
        bottomLine.material = material;
        // bottomLine.renderingGroupId = this.config.renderingGroupId;
        this.crosshairLines.push(bottomLine);

        // Left line
        const leftLine = MeshBuilder.CreateBox("crosshairLeft", {
            width: length,
            height: thickness,
            depth: thickness
        }, this.scene);
        leftLine.parent = this.reticleGroup;
        leftLine.position.x = -(gap + length / 2);
        leftLine.material = material;
        // leftLine.renderingGroupId = this.config.renderingGroupId;
        this.crosshairLines.push(leftLine);

        // Right line
        const rightLine = MeshBuilder.CreateBox("crosshairRight", {
            width: length,
            height: thickness,
            depth: thickness
        }, this.scene);
        rightLine.parent = this.reticleGroup;
        rightLine.position.x = gap + length / 2;
        rightLine.material = material;
        // rightLine.renderingGroupId = this.config.renderingGroupId;
        this.crosshairLines.push(rightLine);

        // Center dot (optional, very small)
        const centerDot = MeshBuilder.CreateSphere("crosshairCenter", {
            diameter: thickness * 1.5
        }, this.scene);
        centerDot.parent = this.reticleGroup;
        centerDot.material = material;
        // centerDot.renderingGroupId = this.config.renderingGroupId;
        this.crosshairLines.push(centerDot);
    }

    /**
     * Set visibility of the sight
     */
    public setVisible(visible: boolean): void {
        this.circle.isVisible = visible;
        this.crosshairLines.forEach(line => line.isVisible = visible);
    }

    /**
     * Change the sight color
     */
    public setColor(color: Color3): void {
        this.config.color = color;
        const material = this.circle.material as StandardMaterial;
        if (material) {
            material.emissiveColor = color;
        }
    }

    /**
     * Get the reticle group transform node
     */
    public getTransformNode(): TransformNode {
        return this.reticleGroup;
    }

    /**
     * Dispose of the sight
     */
    public dispose(): void {
        this.circle.dispose();
        this.crosshairLines.forEach(line => line.dispose());
        this.reticleGroup.dispose();
    }
}
