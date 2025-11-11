import {
    AbstractMesh,
    ArcRotateCamera,
    Scene,
    Vector3
} from "@babylonjs/core";
import debugLog from "../core/debug";

/**
 * Camera modes for replay viewing
 */
export enum CameraMode {
    FREE = "free",
    FOLLOW_SHIP = "follow_ship"
}

/**
 * Manages camera for replay viewing with free and follow modes
 */
export class ReplayCamera {
    private _camera: ArcRotateCamera;
    private _scene: Scene;
    private _mode: CameraMode = CameraMode.FREE;
    private _followTarget: AbstractMesh | null = null;

    constructor(scene: Scene) {
        this._scene = scene;

        // Create orbiting camera
        this._camera = new ArcRotateCamera(
            "replayCamera",
            Math.PI / 2,  // alpha (horizontal rotation)
            Math.PI / 3,  // beta (vertical rotation)
            50,           // radius (distance from target)
            Vector3.Zero(),
            scene
        );

        // Attach controls for user interaction
        const canvas = scene.getEngine().getRenderingCanvas();
        if (canvas) {
            this._camera.attachControl(canvas, true);
        }

        // Set camera limits
        this._camera.lowerRadiusLimit = 10;
        this._camera.upperRadiusLimit = 500;
        this._camera.lowerBetaLimit = 0.1;
        this._camera.upperBetaLimit = Math.PI / 2;

        // Set clipping planes for visibility
        this._camera.minZ = 0.1;  // Very close near plane
        this._camera.maxZ = 5000; // Far plane for distant objects

        // Mouse wheel zoom speed
        this._camera.wheelPrecision = 20;

        // Panning speed
        this._camera.panningSensibility = 50;

        scene.activeCamera = this._camera;

        debugLog("ReplayCamera: Created with clipping planes minZ=0.1, maxZ=5000");
    }

    /**
     * Get the camera instance
     */
    public getCamera(): ArcRotateCamera {
        return this._camera;
    }

    /**
     * Set camera mode
     */
    public setMode(mode: CameraMode): void {
        this._mode = mode;
        debugLog(`ReplayCamera: Mode set to ${mode}`);
    }

    /**
     * Get current mode
     */
    public getMode(): CameraMode {
        return this._mode;
    }

    /**
     * Toggle between free and follow modes
     */
    public toggleMode(): void {
        if (this._mode === CameraMode.FREE) {
            this.setMode(CameraMode.FOLLOW_SHIP);
        } else {
            this.setMode(CameraMode.FREE);
        }
    }

    /**
     * Set target to follow (usually the ship)
     */
    public setFollowTarget(mesh: AbstractMesh | null): void {
        this._followTarget = mesh;
        if (mesh) {
            this._camera.setTarget(mesh.position);
            debugLog("ReplayCamera: Follow target set");
        }
    }

    /**
     * Calculate optimal viewpoint to frame all objects
     */
    public frameAllObjects(objects: AbstractMesh[]): void {
        if (objects.length === 0) {
            return;
        }

        // Calculate bounding box of all objects
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        objects.forEach(obj => {
            const pos = obj.position;
            debugLog(`ReplayCamera: Framing object ${obj.name} at position ${pos.toString()}`);
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            minZ = Math.min(minZ, pos.z);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
            maxZ = Math.max(maxZ, pos.z);
        });

        // Calculate center
        const center = new Vector3(
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2
        );

        // Calculate size
        const size = Math.max(
            maxX - minX,
            maxY - minY,
            maxZ - minZ
        );

        // Position camera to frame everything
        this._camera.setTarget(center);
        this._camera.radius = Math.max(50, size * 1.5); // At least 50 units away

        debugLog(`ReplayCamera: Framed ${objects.length} objects (radius: ${this._camera.radius.toFixed(1)})`);
    }

    /**
     * Update camera (call every frame)
     */
    public update(): void {
        if (this._mode === CameraMode.FOLLOW_SHIP && this._followTarget) {
            // Smooth camera following with lerp
            Vector3.LerpToRef(
                this._camera.target,
                this._followTarget.position,
                0.1, // Smoothing factor (0 = no follow, 1 = instant)
                this._camera.target
            );
        }
    }

    /**
     * Reset camera to default position
     */
    public reset(): void {
        this._camera.alpha = Math.PI / 2;
        this._camera.beta = Math.PI / 3;
        this._camera.radius = 50;
        this._camera.setTarget(Vector3.Zero());
        debugLog("ReplayCamera: Reset to default");
    }

    /**
     * Dispose of camera
     */
    public dispose(): void {
        this._camera.dispose();
        debugLog("ReplayCamera: Disposed");
    }
}
