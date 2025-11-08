import {
    AbstractMesh,
    Observable,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    Quaternion,
    Scene,
    Vector3
} from "@babylonjs/core";
import { PhysicsRecording, PhysicsSnapshot } from "../physicsRecorder";
import { ReplayAssetRegistry } from "./ReplayAssetRegistry";
import debugLog from "../debug";

/**
 * Handles frame-by-frame playback of physics recordings
 * with interpolation for smooth visuals
 */
export class ReplayPlayer {
    private _scene: Scene;
    private _recording: PhysicsRecording;
    private _assetRegistry: ReplayAssetRegistry;
    private _replayObjects: Map<string, AbstractMesh> = new Map();

    // Playback state
    private _currentFrameIndex: number = 0;
    private _isPlaying: boolean = false;
    private _playbackSpeed: number = 1.0;

    // Timing
    private _physicsHz: number;
    private _frameDuration: number; // milliseconds per physics frame
    private _lastUpdateTime: number = 0;
    private _accumulatedTime: number = 0;

    // Observables
    public onPlayStateChanged: Observable<boolean> = new Observable<boolean>();
    public onFrameChanged: Observable<number> = new Observable<number>();

    constructor(scene: Scene, recording: PhysicsRecording, assetRegistry: ReplayAssetRegistry) {
        this._scene = scene;
        this._recording = recording;
        this._assetRegistry = assetRegistry;
        this._physicsHz = recording.metadata.physicsUpdateRate || 7.2;
        this._frameDuration = 1000 / this._physicsHz; // ~138.9ms at 7.2 Hz
    }

    /**
     * Initialize replay by creating all meshes from first snapshot
     */
    public async initialize(): Promise<void> {
        if (this._recording.snapshots.length === 0) {
            debugLog("ReplayPlayer: No snapshots in recording");
            return;
        }

        const firstSnapshot = this._recording.snapshots[0];
        debugLog(`ReplayPlayer: Creating ${firstSnapshot.objects.length} replay objects`);

        for (const objState of firstSnapshot.objects) {
            const mesh = this._assetRegistry.createReplayMesh(objState.id);
            if (!mesh) {
                continue; // Skip objects we can't create (like ammo)
            }

            this._replayObjects.set(objState.id, mesh);

            // Create physics body (ANIMATED = kinematic, we control position directly)
            try {
                const agg = new PhysicsAggregate(
                    mesh,
                    PhysicsShapeType.MESH,
                    {
                        mass: objState.mass,
                        restitution: objState.restitution
                    },
                    this._scene
                );
                agg.body.setMotionType(PhysicsMotionType.ANIMATED);
            } catch (error) {
                debugLog(`ReplayPlayer: Could not create physics for ${objState.id}`, error);
            }
        }

        // Apply first frame state
        this.applySnapshot(firstSnapshot);
        debugLog(`ReplayPlayer: Initialized with ${this._replayObjects.size} objects`);
    }

    /**
     * Start playback
     */
    public play(): void {
        if (this._isPlaying) {
            return;
        }

        this._isPlaying = true;
        this._lastUpdateTime = performance.now();
        this.onPlayStateChanged.notifyObservers(true);

        // Use scene.onBeforeRenderObservable for smooth updates
        this._scene.onBeforeRenderObservable.add(this.updateCallback);

        debugLog("ReplayPlayer: Playback started");
    }

    /**
     * Pause playback
     */
    public pause(): void {
        if (!this._isPlaying) {
            return;
        }

        this._isPlaying = false;
        this._scene.onBeforeRenderObservable.removeCallback(this.updateCallback);
        this.onPlayStateChanged.notifyObservers(false);

        debugLog("ReplayPlayer: Playback paused");
    }

    /**
     * Toggle play/pause
     */
    public togglePlayPause(): void {
        if (this._isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Update callback for render loop
     */
    private updateCallback = (): void => {
        if (!this._isPlaying) {
            return;
        }

        const now = performance.now();
        const deltaTime = (now - this._lastUpdateTime) * this._playbackSpeed;
        this._lastUpdateTime = now;

        this._accumulatedTime += deltaTime;

        // Update when enough time has passed for next frame
        while (this._accumulatedTime >= this._frameDuration) {
            this._accumulatedTime -= this._frameDuration;
            this.advanceFrame();
        }

        // Interpolate between frames for smooth motion
        const alpha = this._accumulatedTime / this._frameDuration;
        this.interpolateFrame(alpha);
    };

    /**
     * Advance to next frame
     */
    private advanceFrame(): void {
        this._currentFrameIndex++;

        if (this._currentFrameIndex >= this._recording.snapshots.length) {
            // End of recording
            this._currentFrameIndex = this._recording.snapshots.length - 1;
            this.pause();
            debugLog("ReplayPlayer: Reached end of recording");
            return;
        }

        const snapshot = this._recording.snapshots[this._currentFrameIndex];
        this.applySnapshot(snapshot);
        this.onFrameChanged.notifyObservers(this._currentFrameIndex);
    }

    /**
     * Apply a snapshot's state to all objects
     */
    private applySnapshot(snapshot: PhysicsSnapshot): void {
        for (const objState of snapshot.objects) {
            const mesh = this._replayObjects.get(objState.id);
            if (!mesh) {
                continue;
            }

            // Apply position
            mesh.position.set(
                objState.position[0],
                objState.position[1],
                objState.position[2]
            );

            // Apply rotation (quaternion)
            if (!mesh.rotationQuaternion) {
                mesh.rotationQuaternion = new Quaternion();
            }
            mesh.rotationQuaternion.set(
                objState.rotation[0],
                objState.rotation[1],
                objState.rotation[2],
                objState.rotation[3]
            );

            // Update physics body transform if exists
            if (mesh.physicsBody) {
                mesh.physicsBody.setTargetTransform(
                    mesh.position,
                    mesh.rotationQuaternion
                );
            }
        }
    }

    /**
     * Interpolate between current and next frame for smooth visuals
     */
    private interpolateFrame(alpha: number): void {
        if (this._currentFrameIndex + 1 >= this._recording.snapshots.length) {
            return; // No next frame
        }

        const currentSnapshot = this._recording.snapshots[this._currentFrameIndex];
        const nextSnapshot = this._recording.snapshots[this._currentFrameIndex + 1];

        for (const objState of currentSnapshot.objects) {
            const mesh = this._replayObjects.get(objState.id);
            if (!mesh) {
                continue;
            }

            const nextState = nextSnapshot.objects.find(o => o.id === objState.id);
            if (!nextState) {
                continue;
            }

            // Lerp position
            Vector3.LerpToRef(
                new Vector3(...objState.position),
                new Vector3(...nextState.position),
                alpha,
                mesh.position
            );

            // Slerp rotation
            if (!mesh.rotationQuaternion) {
                mesh.rotationQuaternion = new Quaternion();
            }
            Quaternion.SlerpToRef(
                new Quaternion(...objState.rotation),
                new Quaternion(...nextState.rotation),
                alpha,
                mesh.rotationQuaternion
            );
        }
    }

    /**
     * Scrub to specific frame
     */
    public scrubTo(frameIndex: number): void {
        this._currentFrameIndex = Math.max(0, Math.min(frameIndex, this._recording.snapshots.length - 1));
        const snapshot = this._recording.snapshots[this._currentFrameIndex];
        this.applySnapshot(snapshot);
        this._accumulatedTime = 0; // Reset interpolation
        this.onFrameChanged.notifyObservers(this._currentFrameIndex);
    }

    /**
     * Step forward one frame
     */
    public stepForward(): void {
        if (this._currentFrameIndex < this._recording.snapshots.length - 1) {
            this.scrubTo(this._currentFrameIndex + 1);
        }
    }

    /**
     * Step backward one frame
     */
    public stepBackward(): void {
        if (this._currentFrameIndex > 0) {
            this.scrubTo(this._currentFrameIndex - 1);
        }
    }

    /**
     * Set playback speed multiplier
     */
    public setPlaybackSpeed(speed: number): void {
        this._playbackSpeed = Math.max(0.1, Math.min(speed, 4.0));
        debugLog(`ReplayPlayer: Playback speed set to ${this._playbackSpeed}x`);
    }

    /**
     * Get current frame index
     */
    public getCurrentFrame(): number {
        return this._currentFrameIndex;
    }

    /**
     * Get total number of frames
     */
    public getTotalFrames(): number {
        return this._recording.snapshots.length;
    }

    /**
     * Get current playback time in seconds
     */
    public getCurrentTime(): number {
        if (this._recording.snapshots.length === 0) {
            return 0;
        }
        return this._recording.snapshots[this._currentFrameIndex].timestamp / 1000;
    }

    /**
     * Get total duration in seconds
     */
    public getTotalDuration(): number {
        return this._recording.metadata.recordingDuration / 1000;
    }

    /**
     * Check if playing
     */
    public isPlaying(): boolean {
        return this._isPlaying;
    }

    /**
     * Get replay objects map
     */
    public getReplayObjects(): Map<string, AbstractMesh> {
        return this._replayObjects;
    }

    /**
     * Get ship mesh if it exists
     */
    public getShipMesh(): AbstractMesh | null {
        for (const [id, mesh] of this._replayObjects.entries()) {
            if (id === "ship" || id.startsWith("shipBase")) {
                return mesh;
            }
        }
        return null;
    }

    /**
     * Dispose of replay player
     */
    public dispose(): void {
        this.pause();
        this._scene.onBeforeRenderObservable.removeCallback(this.updateCallback);
        this.onPlayStateChanged.clear();
        this.onFrameChanged.clear();

        // Dispose all replay objects
        this._replayObjects.forEach((mesh) => {
            if (mesh.physicsBody) {
                mesh.physicsBody.dispose();
            }
            mesh.dispose();
        });
        this._replayObjects.clear();

        debugLog("ReplayPlayer: Disposed");
    }
}
