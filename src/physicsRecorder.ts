import { Scene, Vector3, Quaternion, AbstractMesh } from "@babylonjs/core";
import debugLog from "./debug";
import { PhysicsStorage } from "./physicsStorage";

/**
 * Represents the physics state of a single object at a point in time
 */
export interface PhysicsObjectState {
    id: string;
    position: [number, number, number];
    rotation: [number, number, number, number]; // Quaternion (x, y, z, w)
    linearVelocity: [number, number, number];
    angularVelocity: [number, number, number];
    mass: number;
    restitution: number;
}

/**
 * Snapshot of all physics objects at a specific time
 */
export interface PhysicsSnapshot {
    timestamp: number; // Physics time in milliseconds
    frameNumber: number; // Sequential frame counter
    objects: PhysicsObjectState[];
}

/**
 * Recording metadata
 */
export interface RecordingMetadata {
    startTime: number;
    endTime: number;
    frameCount: number;
    recordingDuration: number; // milliseconds
    physicsUpdateRate: number; // Hz
}

/**
 * Complete recording with metadata and snapshots
 */
export interface PhysicsRecording {
    metadata: RecordingMetadata;
    snapshots: PhysicsSnapshot[];
}

/**
 * Physics state recorder that continuously captures physics state
 * - Ring buffer mode: Always captures last N seconds (low memory, quick export)
 * - Long recording mode: Saves to IndexedDB for 2-10 minute recordings
 */
export class PhysicsRecorder {
    private _scene: Scene;
    private _isEnabled: boolean = false;
    private _isLongRecording: boolean = false;

    // Ring buffer for continuous recording
    private _ringBuffer: PhysicsSnapshot[] = [];
    private _maxRingBufferFrames: number = 216; // 30 seconds at 7.2 Hz
    private _ringBufferIndex: number = 0;

    // Long recording storage
    private _longRecording: PhysicsSnapshot[] = [];
    private _longRecordingStartTime: number = 0;

    // Frame tracking
    private _frameNumber: number = 0;
    private _startTime: number = 0;
    private _physicsUpdateRate: number = 7.2; // Hz (estimated)

    // Performance tracking
    private _captureTimeAccumulator: number = 0;
    private _captureCount: number = 0;

    // IndexedDB storage
    private _storage: PhysicsStorage | null = null;

    constructor(scene: Scene) {
        this._scene = scene;

        // Initialize IndexedDB storage
        this._storage = new PhysicsStorage();
        this._storage.initialize().catch(error => {
            debugLog("PhysicsRecorder: Failed to initialize storage", error);
        });
    }

    /**
     * Start the ring buffer recorder (always capturing last 30 seconds)
     */
    public startRingBuffer(): void {
        if (this._isEnabled) {
            debugLog("PhysicsRecorder: Ring buffer already running");
            return;
        }

        this._isEnabled = true;
        this._startTime = performance.now();
        this._frameNumber = 0;

        // Hook into physics update observable
        this._scene.onAfterPhysicsObservable.add(() => {
            if (this._isEnabled) {
                this.captureFrame();
            }
        });

        debugLog("PhysicsRecorder: Ring buffer started (30 second capacity)");
    }

    /**
     * Stop the ring buffer recorder
     */
    public stopRingBuffer(): void {
        this._isEnabled = false;
        debugLog("PhysicsRecorder: Ring buffer stopped");
    }

    /**
     * Start a long-term recording (saves all frames to memory)
     */
    public startLongRecording(): void {
        if (this._isLongRecording) {
            debugLog("PhysicsRecorder: Long recording already in progress");
            return;
        }

        this._isLongRecording = true;
        this._longRecording = [];
        this._longRecordingStartTime = performance.now();

        debugLog("PhysicsRecorder: Long recording started");
    }

    /**
     * Stop long-term recording
     */
    public stopLongRecording(): void {
        if (!this._isLongRecording) {
            debugLog("PhysicsRecorder: No long recording in progress");
            return;
        }

        this._isLongRecording = false;
        const duration = ((performance.now() - this._longRecordingStartTime) / 1000).toFixed(1);
        debugLog(`PhysicsRecorder: Long recording stopped (${duration}s, ${this._longRecording.length} frames)`);
    }

    /**
     * Capture current physics state of all objects
     */
    private captureFrame(): void {
        const captureStart = performance.now();

        const timestamp = performance.now() - this._startTime;
        const objects: PhysicsObjectState[] = [];

        // Get all physics-enabled meshes
        const physicsMeshes = this._scene.meshes.filter(mesh => mesh.physicsBody !== null);

        for (const mesh of physicsMeshes) {
            const body = mesh.physicsBody!;

            // Get position
            const pos = body.transformNode.position;

            // Get rotation as quaternion
            let quat = body.transformNode.rotationQuaternion;
            if (!quat) {
                // Convert Euler to Quaternion if needed
                const rot = body.transformNode.rotation;
                quat = Quaternion.FromEulerAngles(rot.x, rot.y, rot.z);
            }

            // Get velocities
            const linVel = body.getLinearVelocity();
            const angVel = body.getAngularVelocity();

            // Get mass
            const mass = body.getMassProperties().mass;

            // Get restitution (from shape material if available)
            let restitution = 0;
            if (body.shape && (body.shape as any).material) {
                restitution = (body.shape as any).material.restitution || 0;
            }

            objects.push({
                id: mesh.id,
                position: [
                    parseFloat(pos.x.toFixed(3)),
                    parseFloat(pos.y.toFixed(3)),
                    parseFloat(pos.z.toFixed(3))
                ],
                rotation: [
                    parseFloat(quat.x.toFixed(4)),
                    parseFloat(quat.y.toFixed(4)),
                    parseFloat(quat.z.toFixed(4)),
                    parseFloat(quat.w.toFixed(4))
                ],
                linearVelocity: [
                    parseFloat(linVel.x.toFixed(3)),
                    parseFloat(linVel.y.toFixed(3)),
                    parseFloat(linVel.z.toFixed(3))
                ],
                angularVelocity: [
                    parseFloat(angVel.x.toFixed(3)),
                    parseFloat(angVel.y.toFixed(3)),
                    parseFloat(angVel.z.toFixed(3))
                ],
                mass: parseFloat(mass.toFixed(2)),
                restitution: parseFloat(restitution.toFixed(2))
            });
        }

        const snapshot: PhysicsSnapshot = {
            timestamp: parseFloat(timestamp.toFixed(1)),
            frameNumber: this._frameNumber,
            objects
        };

        // Add to ring buffer (circular overwrite)
        this._ringBuffer[this._ringBufferIndex] = snapshot;
        this._ringBufferIndex = (this._ringBufferIndex + 1) % this._maxRingBufferFrames;

        // Add to long recording if active
        if (this._isLongRecording) {
            this._longRecording.push(snapshot);
        }

        this._frameNumber++;

        // Track performance
        const captureTime = performance.now() - captureStart;
        this._captureTimeAccumulator += captureTime;
        this._captureCount++;

        // Log average capture time every 100 frames
        if (this._captureCount % 100 === 0) {
            const avgTime = (this._captureTimeAccumulator / this._captureCount).toFixed(3);
            debugLog(`PhysicsRecorder: Average capture time: ${avgTime}ms (${objects.length} objects)`);
        }
    }

    /**
     * Export last N seconds from ring buffer
     */
    public exportRingBuffer(seconds: number = 30): PhysicsRecording {
        const maxFrames = Math.min(
            Math.floor(seconds * this._physicsUpdateRate),
            this._maxRingBufferFrames
        );

        // Extract frames from ring buffer (handling circular nature)
        const snapshots: PhysicsSnapshot[] = [];
        const startIndex = (this._ringBufferIndex - maxFrames + this._maxRingBufferFrames) % this._maxRingBufferFrames;

        for (let i = 0; i < maxFrames; i++) {
            const index = (startIndex + i) % this._maxRingBufferFrames;
            const snapshot = this._ringBuffer[index];
            if (snapshot) {
                snapshots.push(snapshot);
            }
        }

        // Sort by frame number to ensure correct order
        snapshots.sort((a, b) => a.frameNumber - b.frameNumber);

        const metadata: RecordingMetadata = {
            startTime: snapshots[0]?.timestamp || 0,
            endTime: snapshots[snapshots.length - 1]?.timestamp || 0,
            frameCount: snapshots.length,
            recordingDuration: (snapshots[snapshots.length - 1]?.timestamp || 0) - (snapshots[0]?.timestamp || 0),
            physicsUpdateRate: this._physicsUpdateRate
        };

        return {
            metadata,
            snapshots
        };
    }

    /**
     * Export long recording
     */
    public exportLongRecording(): PhysicsRecording {
        if (this._longRecording.length === 0) {
            debugLog("PhysicsRecorder: No long recording data to export");
            return {
                metadata: {
                    startTime: 0,
                    endTime: 0,
                    frameCount: 0,
                    recordingDuration: 0,
                    physicsUpdateRate: this._physicsUpdateRate
                },
                snapshots: []
            };
        }

        const metadata: RecordingMetadata = {
            startTime: this._longRecording[0].timestamp,
            endTime: this._longRecording[this._longRecording.length - 1].timestamp,
            frameCount: this._longRecording.length,
            recordingDuration: this._longRecording[this._longRecording.length - 1].timestamp - this._longRecording[0].timestamp,
            physicsUpdateRate: this._physicsUpdateRate
        };

        return {
            metadata,
            snapshots: this._longRecording
        };
    }

    /**
     * Download recording as JSON file
     */
    public downloadRecording(recording: PhysicsRecording, filename: string = "physics-recording"): void {
        const json = JSON.stringify(recording, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}-${Date.now()}.json`;
        link.click();

        URL.revokeObjectURL(url);

        const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
        const duration = (recording.metadata.recordingDuration / 1000).toFixed(1);
        debugLog(`PhysicsRecorder: Downloaded ${filename} (${sizeMB} MB, ${duration}s, ${recording.metadata.frameCount} frames)`);
    }

    /**
     * Get recording statistics
     */
    public getStats(): {
        isRecording: boolean;
        isLongRecording: boolean;
        ringBufferFrames: number;
        ringBufferDuration: number;
        longRecordingFrames: number;
        longRecordingDuration: number;
        averageCaptureTime: number;
    } {
        const ringBufferDuration = this._ringBuffer.length > 0
            ? (this._ringBuffer[this._ringBuffer.length - 1]?.timestamp || 0) - (this._ringBuffer[0]?.timestamp || 0)
            : 0;

        const longRecordingDuration = this._longRecording.length > 0
            ? this._longRecording[this._longRecording.length - 1].timestamp - this._longRecording[0].timestamp
            : 0;

        return {
            isRecording: this._isEnabled,
            isLongRecording: this._isLongRecording,
            ringBufferFrames: this._ringBuffer.filter(s => s !== undefined).length,
            ringBufferDuration: ringBufferDuration / 1000, // Convert to seconds
            longRecordingFrames: this._longRecording.length,
            longRecordingDuration: longRecordingDuration / 1000, // Convert to seconds
            averageCaptureTime: this._captureCount > 0 ? this._captureTimeAccumulator / this._captureCount : 0
        };
    }

    /**
     * Clear long recording data
     */
    public clearLongRecording(): void {
        this._longRecording = [];
        this._isLongRecording = false;
        debugLog("PhysicsRecorder: Long recording data cleared");
    }

    /**
     * Save current long recording to IndexedDB
     */
    public async saveLongRecordingToStorage(name: string): Promise<string | null> {
        if (!this._storage) {
            debugLog("PhysicsRecorder: Storage not initialized");
            return null;
        }

        const recording = this.exportLongRecording();
        if (recording.snapshots.length === 0) {
            debugLog("PhysicsRecorder: No recording data to save");
            return null;
        }

        try {
            const recordingId = await this._storage.saveRecording(name, recording);
            debugLog(`PhysicsRecorder: Saved to IndexedDB with ID: ${recordingId}`);
            return recordingId;
        } catch (error) {
            debugLog("PhysicsRecorder: Error saving to IndexedDB", error);
            return null;
        }
    }

    /**
     * Save ring buffer to IndexedDB
     */
    public async saveRingBufferToStorage(name: string, seconds: number = 30): Promise<string | null> {
        if (!this._storage) {
            debugLog("PhysicsRecorder: Storage not initialized");
            return null;
        }

        const recording = this.exportRingBuffer(seconds);
        if (recording.snapshots.length === 0) {
            debugLog("PhysicsRecorder: No ring buffer data to save");
            return null;
        }

        try {
            const recordingId = await this._storage.saveRecording(name, recording);
            debugLog(`PhysicsRecorder: Saved ring buffer to IndexedDB with ID: ${recordingId}`);
            return recordingId;
        } catch (error) {
            debugLog("PhysicsRecorder: Error saving ring buffer to IndexedDB", error);
            return null;
        }
    }

    /**
     * Load a recording from IndexedDB
     */
    public async loadRecordingFromStorage(recordingId: string): Promise<PhysicsRecording | null> {
        if (!this._storage) {
            debugLog("PhysicsRecorder: Storage not initialized");
            return null;
        }

        try {
            return await this._storage.loadRecording(recordingId);
        } catch (error) {
            debugLog("PhysicsRecorder: Error loading from IndexedDB", error);
            return null;
        }
    }

    /**
     * List all recordings in IndexedDB
     */
    public async listStoredRecordings(): Promise<Array<{
        id: string;
        name: string;
        timestamp: number;
        duration: number;
        frameCount: number;
    }>> {
        if (!this._storage) {
            debugLog("PhysicsRecorder: Storage not initialized");
            return [];
        }

        try {
            return await this._storage.listRecordings();
        } catch (error) {
            debugLog("PhysicsRecorder: Error listing recordings", error);
            return [];
        }
    }

    /**
     * Delete a recording from IndexedDB
     */
    public async deleteStoredRecording(recordingId: string): Promise<boolean> {
        if (!this._storage) {
            debugLog("PhysicsRecorder: Storage not initialized");
            return false;
        }

        try {
            await this._storage.deleteRecording(recordingId);
            return true;
        } catch (error) {
            debugLog("PhysicsRecorder: Error deleting recording", error);
            return false;
        }
    }

    /**
     * Get storage statistics
     */
    public async getStorageStats(): Promise<{
        recordingCount: number;
        totalSegments: number;
        estimatedSizeMB: number;
    } | null> {
        if (!this._storage) {
            return null;
        }

        try {
            return await this._storage.getStats();
        } catch (error) {
            debugLog("PhysicsRecorder: Error getting storage stats", error);
            return null;
        }
    }

    /**
     * Dispose of recorder resources
     */
    public dispose(): void {
        this.stopRingBuffer();
        this.stopLongRecording();
        this._ringBuffer = [];
        this._longRecording = [];

        if (this._storage) {
            this._storage.close();
        }
    }
}
