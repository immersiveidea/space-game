import {
    AbstractMesh,
    Observable,
    Quaternion,
    Scene,
    Vector3
} from "@babylonjs/core";
import { PhysicsRecording, PhysicsSnapshot } from "./recording/physicsRecorder";
import debugLog from "../core/debug";

/**
 * Handles frame-by-frame playback of physics recordings
 * with interpolation for smooth visuals
 */
export class ReplayPlayer {
    private _scene: Scene;
    private _recording: PhysicsRecording;
    private _replayObjects: Map<string, AbstractMesh> = new Map();

    // Playback state
    private _currentFrameIndex: number = 0;
    private _isPlaying: boolean = false;
    private _playbackSpeed: number = 1.0;

    // Timing (timestamp-based, not Hz-based)
    private _playbackStartTime: number = 0; // Real-world time when playback started
    private _recordingStartTimestamp: number = 0; // First snapshot's timestamp
    private _lastUpdateTime: number = 0;

    // Observables
    public onPlayStateChanged: Observable<boolean> = new Observable<boolean>();
    public onFrameChanged: Observable<number> = new Observable<number>();

    constructor(scene: Scene, recording: PhysicsRecording) {
        this._scene = scene;
        this._recording = recording;

        // Store first snapshot's timestamp as our recording start reference
        if (recording.snapshots.length > 0) {
            this._recordingStartTimestamp = recording.snapshots[0].timestamp;
        }
    }

    /**
     * Initialize replay by finding existing meshes in the scene
     * (Level1.initialize() has already created all objects)
     */
    public async initialize(): Promise<void> {
        if (this._recording.snapshots.length === 0) {
            debugLog("ReplayPlayer: No snapshots in recording");
            return;
        }

        const firstSnapshot = this._recording.snapshots[0];
        debugLog(`ReplayPlayer: Initializing replay for ${firstSnapshot.objects.length} objects`);
        debugLog(`ReplayPlayer: Object IDs in snapshot: ${firstSnapshot.objects.map(o => o.id).join(', ')}`);

        // Find all existing meshes in the scene (already created by Level1.initialize())
        for (const objState of firstSnapshot.objects) {
            const mesh = this._scene.getMeshByName(objState.id) as AbstractMesh;

            if (mesh) {
                this._replayObjects.set(objState.id, mesh);
                debugLog(`ReplayPlayer: Found ${objState.id} in scene (physics: ${!!mesh.physicsBody})`);
            } else {
                debugLog(`ReplayPlayer: WARNING - Object ${objState.id} not found in scene`);
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
        this._playbackStartTime = performance.now();
        this._lastUpdateTime = this._playbackStartTime;
        this.onPlayStateChanged.notifyObservers(true);

        // Use scene.onBeforeRenderObservable for smooth updates
        this._scene.onBeforeRenderObservable.add(this.updateCallback);

        debugLog("ReplayPlayer: Playback started (timestamp-based)");
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
     * Update callback for render loop (timestamp-based)
     */
    private updateCallback = (): void => {
        if (!this._isPlaying || this._recording.snapshots.length === 0) {
            return;
        }

        const now = performance.now();

        // Calculate elapsed playback time (with speed multiplier)
        const elapsedPlaybackTime = (now - this._playbackStartTime) * this._playbackSpeed;

        // Calculate target recording timestamp
        const targetTimestamp = this._recordingStartTimestamp + elapsedPlaybackTime;

        // Find the correct frame for this timestamp
        let targetFrameIndex = this._currentFrameIndex;

        // Advance to the frame that matches our target timestamp
        while (targetFrameIndex < this._recording.snapshots.length - 1 &&
               this._recording.snapshots[targetFrameIndex + 1].timestamp <= targetTimestamp) {
            targetFrameIndex++;
        }

        // If we advanced frames, update and notify
        if (targetFrameIndex !== this._currentFrameIndex) {
            this._currentFrameIndex = targetFrameIndex;

            // Debug: Log frame advancement every 10 frames
            if (this._currentFrameIndex % 10 === 0) {
                const snapshot = this._recording.snapshots[this._currentFrameIndex];
                debugLog(`ReplayPlayer: Frame ${this._currentFrameIndex}/${this._recording.snapshots.length}, timestamp: ${snapshot.timestamp.toFixed(1)}ms, objects: ${snapshot.objects.length}`);
            }

            this.applySnapshot(this._recording.snapshots[this._currentFrameIndex]);
            this.onFrameChanged.notifyObservers(this._currentFrameIndex);
        }

        // Check if we reached the end
        if (this._currentFrameIndex >= this._recording.snapshots.length - 1 &&
            targetTimestamp >= this._recording.snapshots[this._recording.snapshots.length - 1].timestamp) {
            this.pause();
            debugLog("ReplayPlayer: Reached end of recording");
            return;
        }

        // Interpolate between current and next frame for smooth visuals
        if (this._currentFrameIndex < this._recording.snapshots.length - 1) {
            const currentSnapshot = this._recording.snapshots[this._currentFrameIndex];
            const nextSnapshot = this._recording.snapshots[this._currentFrameIndex + 1];

            const frameDuration = nextSnapshot.timestamp - currentSnapshot.timestamp;
            const frameElapsed = targetTimestamp - currentSnapshot.timestamp;
            const alpha = frameDuration > 0 ? Math.min(frameElapsed / frameDuration, 1.0) : 0;

            this.interpolateFrame(alpha);
        }
    };


    /**
     * Apply a snapshot's state to all objects
     */
    private applySnapshot(snapshot: PhysicsSnapshot): void {
        for (const objState of snapshot.objects) {
            const mesh = this._replayObjects.get(objState.id);
            if (!mesh) {
                continue;
            }

            const newPosition = new Vector3(
                objState.position[0],
                objState.position[1],
                objState.position[2]
            );

            const newRotation = new Quaternion(
                objState.rotation[0],
                objState.rotation[1],
                objState.rotation[2],
                objState.rotation[3]
            );

            // Update mesh transform directly
            mesh.position.copyFrom(newPosition);
            if (!mesh.rotationQuaternion) {
                mesh.rotationQuaternion = new Quaternion();
            }
            mesh.rotationQuaternion.copyFrom(newRotation);

            // For ANIMATED bodies, sync physics from mesh
            // (ANIMATED bodies should follow their transform node)
            if (mesh.physicsBody) {
                mesh.physicsBody.disablePreStep = false;
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

            // Create temporary vectors for interpolation
            const interpPosition = new Vector3();
            const interpRotation = new Quaternion();

            // Lerp position
            Vector3.LerpToRef(
                new Vector3(...objState.position),
                new Vector3(...nextState.position),
                alpha,
                interpPosition
            );

            // Slerp rotation
            Quaternion.SlerpToRef(
                new Quaternion(...objState.rotation),
                new Quaternion(...nextState.rotation),
                alpha,
                interpRotation
            );

            // Apply interpolated transform to mesh
            mesh.position.copyFrom(interpPosition);
            if (!mesh.rotationQuaternion) {
                mesh.rotationQuaternion = new Quaternion();
            }
            mesh.rotationQuaternion.copyFrom(interpRotation);

            // Physics body will sync from mesh if ANIMATED
            if (mesh.physicsBody) {
                mesh.physicsBody.disablePreStep = false;
            }
        }
    }

    /**
     * Scrub to specific frame
     */
    public scrubTo(frameIndex: number): void {
        this._currentFrameIndex = Math.max(0, Math.min(frameIndex, this._recording.snapshots.length - 1));
        const snapshot = this._recording.snapshots[this._currentFrameIndex];
        this.applySnapshot(snapshot);

        // Reset playback timing to match the new frame's timestamp
        if (this._isPlaying) {
            const targetTimestamp = snapshot.timestamp;
            const elapsedRecordingTime = targetTimestamp - this._recordingStartTimestamp;
            this._playbackStartTime = performance.now() - (elapsedRecordingTime / this._playbackSpeed);
        }

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
