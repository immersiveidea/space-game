import { PhysicsRecording, PhysicsSnapshot } from "./physicsRecorder";
import debugLog from "./debug";

/**
 * IndexedDB storage for physics recordings
 * Stores recordings in 1-second segments for efficient retrieval and seeking
 */
export class PhysicsStorage {
    private static readonly DB_NAME = "PhysicsRecordings";
    private static readonly DB_VERSION = 1;
    private static readonly STORE_NAME = "recordings";
    private _db: IDBDatabase | null = null;

    /**
     * Initialize the IndexedDB database
     */
    public async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(PhysicsStorage.DB_NAME, PhysicsStorage.DB_VERSION);

            request.onerror = () => {
                debugLog("PhysicsStorage: Failed to open IndexedDB", request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this._db = request.result;
                debugLog("PhysicsStorage: IndexedDB opened successfully");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(PhysicsStorage.STORE_NAME)) {
                    const objectStore = db.createObjectStore(PhysicsStorage.STORE_NAME, {
                        keyPath: "id",
                        autoIncrement: true
                    });

                    // Create indexes for efficient querying
                    objectStore.createIndex("recordingId", "recordingId", { unique: false });
                    objectStore.createIndex("timestamp", "timestamp", { unique: false });
                    objectStore.createIndex("name", "name", { unique: false });

                    debugLog("PhysicsStorage: Object store created");
                }
            };
        });
    }

    /**
     * Save a recording to IndexedDB
     */
    public async saveRecording(name: string, recording: PhysicsRecording): Promise<string> {
        if (!this._db) {
            throw new Error("Database not initialized");
        }

        const recordingId = `recording-${Date.now()}`;
        const segmentSize = 1000; // 1 second at ~7 Hz = ~7 snapshots per segment

        return new Promise((resolve, reject) => {
            const transaction = this._db!.transaction([PhysicsStorage.STORE_NAME], "readwrite");
            const objectStore = transaction.objectStore(PhysicsStorage.STORE_NAME);

            // Split recording into 1-second segments
            const segments: PhysicsSnapshot[][] = [];
            for (let i = 0; i < recording.snapshots.length; i += segmentSize) {
                segments.push(recording.snapshots.slice(i, i + segmentSize));
            }

            let savedCount = 0;

            // Save each segment
            segments.forEach((segment, index) => {
                const segmentData = {
                    recordingId,
                    name,
                    segmentIndex: index,
                    timestamp: segment[0].timestamp,
                    snapshots: segment,
                    metadata: index === 0 ? recording.metadata : null // Only store metadata in first segment
                };

                const request = objectStore.add(segmentData);

                request.onsuccess = () => {
                    savedCount++;
                    if (savedCount === segments.length) {
                        const sizeMB = (JSON.stringify(recording).length / 1024 / 1024).toFixed(2);
                        debugLog(`PhysicsStorage: Saved recording "${name}" (${segments.length} segments, ${sizeMB} MB)`);
                        resolve(recordingId);
                    }
                };

                request.onerror = () => {
                    debugLog("PhysicsStorage: Error saving segment", request.error);
                    reject(request.error);
                };
            });

            transaction.onerror = () => {
                debugLog("PhysicsStorage: Transaction error", transaction.error);
                reject(transaction.error);
            };
        });
    }

    /**
     * Load a recording from IndexedDB
     */
    public async loadRecording(recordingId: string): Promise<PhysicsRecording | null> {
        if (!this._db) {
            throw new Error("Database not initialized");
        }

        return new Promise((resolve, reject) => {
            const transaction = this._db!.transaction([PhysicsStorage.STORE_NAME], "readonly");
            const objectStore = transaction.objectStore(PhysicsStorage.STORE_NAME);
            const index = objectStore.index("recordingId");

            const request = index.getAll(recordingId);

            request.onsuccess = () => {
                const segments = request.result;

                if (segments.length === 0) {
                    resolve(null);
                    return;
                }

                // Sort segments by index
                segments.sort((a, b) => a.segmentIndex - b.segmentIndex);

                // Combine all snapshots
                const allSnapshots: PhysicsSnapshot[] = [];
                let metadata = null;

                segments.forEach(segment => {
                    allSnapshots.push(...segment.snapshots);
                    if (segment.metadata) {
                        metadata = segment.metadata;
                    }
                });

                if (!metadata) {
                    debugLog("PhysicsStorage: Warning - no metadata found in recording");
                    resolve(null);
                    return;
                }

                const recording: PhysicsRecording = {
                    metadata,
                    snapshots: allSnapshots
                };

                debugLog(`PhysicsStorage: Loaded recording "${recordingId}" (${allSnapshots.length} frames)`);
                resolve(recording);
            };

            request.onerror = () => {
                debugLog("PhysicsStorage: Error loading recording", request.error);
                reject(request.error);
            };
        });
    }

    /**
     * List all available recordings
     */
    public async listRecordings(): Promise<Array<{
        id: string;
        name: string;
        timestamp: number;
        duration: number;
        frameCount: number;
    }>> {
        if (!this._db) {
            throw new Error("Database not initialized");
        }

        return new Promise((resolve, reject) => {
            const transaction = this._db!.transaction([PhysicsStorage.STORE_NAME], "readonly");
            const objectStore = transaction.objectStore(PhysicsStorage.STORE_NAME);

            const request = objectStore.getAll();

            request.onsuccess = () => {
                const allSegments = request.result;

                // Group by recordingId and get first segment (which has metadata)
                const recordingMap = new Map();

                allSegments.forEach(segment => {
                    if (!recordingMap.has(segment.recordingId) && segment.metadata) {
                        recordingMap.set(segment.recordingId, {
                            id: segment.recordingId,
                            name: segment.name,
                            timestamp: segment.timestamp,
                            duration: segment.metadata.recordingDuration / 1000, // Convert to seconds
                            frameCount: segment.metadata.frameCount
                        });
                    }
                });

                const recordings = Array.from(recordingMap.values());
                debugLog(`PhysicsStorage: Found ${recordings.length} recordings`);
                resolve(recordings);
            };

            request.onerror = () => {
                debugLog("PhysicsStorage: Error listing recordings", request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Delete a recording from IndexedDB
     */
    public async deleteRecording(recordingId: string): Promise<void> {
        if (!this._db) {
            throw new Error("Database not initialized");
        }

        return new Promise((resolve, reject) => {
            const transaction = this._db!.transaction([PhysicsStorage.STORE_NAME], "readwrite");
            const objectStore = transaction.objectStore(PhysicsStorage.STORE_NAME);
            const index = objectStore.index("recordingId");

            // Get all segments with this recordingId
            const getAllRequest = index.getAll(recordingId);

            getAllRequest.onsuccess = () => {
                const segments = getAllRequest.result;
                let deletedCount = 0;

                if (segments.length === 0) {
                    resolve();
                    return;
                }

                // Delete each segment
                segments.forEach(segment => {
                    const deleteRequest = objectStore.delete(segment.id);

                    deleteRequest.onsuccess = () => {
                        deletedCount++;
                        if (deletedCount === segments.length) {
                            debugLog(`PhysicsStorage: Deleted recording "${recordingId}" (${segments.length} segments)`);
                            resolve();
                        }
                    };

                    deleteRequest.onerror = () => {
                        debugLog("PhysicsStorage: Error deleting segment", deleteRequest.error);
                        reject(deleteRequest.error);
                    };
                });
            };

            getAllRequest.onerror = () => {
                debugLog("PhysicsStorage: Error getting segments for deletion", getAllRequest.error);
                reject(getAllRequest.error);
            };
        });
    }

    /**
     * Clear all recordings from IndexedDB
     */
    public async clearAll(): Promise<void> {
        if (!this._db) {
            throw new Error("Database not initialized");
        }

        return new Promise((resolve, reject) => {
            const transaction = this._db!.transaction([PhysicsStorage.STORE_NAME], "readwrite");
            const objectStore = transaction.objectStore(PhysicsStorage.STORE_NAME);

            const request = objectStore.clear();

            request.onsuccess = () => {
                debugLog("PhysicsStorage: All recordings cleared");
                resolve();
            };

            request.onerror = () => {
                debugLog("PhysicsStorage: Error clearing recordings", request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get database statistics
     */
    public async getStats(): Promise<{
        recordingCount: number;
        totalSegments: number;
        estimatedSizeMB: number;
    }> {
        if (!this._db) {
            throw new Error("Database not initialized");
        }

        return new Promise((resolve, reject) => {
            const transaction = this._db!.transaction([PhysicsStorage.STORE_NAME], "readonly");
            const objectStore = transaction.objectStore(PhysicsStorage.STORE_NAME);

            const request = objectStore.getAll();

            request.onsuccess = () => {
                const allSegments = request.result;

                // Count unique recordings
                const uniqueRecordings = new Set(allSegments.map(s => s.recordingId));

                // Estimate size (rough approximation)
                const estimatedSizeMB = allSegments.length > 0
                    ? (JSON.stringify(allSegments).length / 1024 / 1024)
                    : 0;

                resolve({
                    recordingCount: uniqueRecordings.size,
                    totalSegments: allSegments.length,
                    estimatedSizeMB: parseFloat(estimatedSizeMB.toFixed(2))
                });
            };

            request.onerror = () => {
                debugLog("PhysicsStorage: Error getting stats", request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Close the database connection
     */
    public close(): void {
        if (this._db) {
            this._db.close();
            this._db = null;
            debugLog("PhysicsStorage: Database closed");
        }
    }
}
