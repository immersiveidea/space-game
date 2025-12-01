import type { AudioEngineV2, StaticSound, Observable, Observer } from "@babylonjs/core";
import { HintService, HintEntry } from "../../services/hintService";
import { ShipStatus, ShipStatusChangeEvent } from "../../ship/shipStatus";
import { ScoreEvent } from "../../ui/hud/scoreboard";
import log from "../../core/logger";

/**
 * Collision event for hint triggers
 */
export interface CollisionEvent {
    collisionType: string;
}

/**
 * Manages level-specific hint audio playback
 * Loads hints from database and triggers audio based on game events
 */
export class LevelHintSystem {
    private _audioEngine: AudioEngineV2;
    private _hints: HintEntry[] = [];
    private _playedHints: Set<string> = new Set();
    private _audioQueue: StaticSound[] = [];
    private _isPlaying: boolean = false;
    private _asteroidsDestroyed: number = 0;

    // Observers for cleanup
    private _statusObserver: Observer<ShipStatusChangeEvent> | null = null;
    private _scoreObserver: Observer<ScoreEvent> | null = null;
    private _collisionObserver: Observer<CollisionEvent> | null = null;

    // Track triggered thresholds to prevent re-triggering
    private _triggeredThresholds: Set<string> = new Set();

    constructor(audioEngine: AudioEngineV2) {
        this._audioEngine = audioEngine;
    }

    /**
     * Load hints for a level from database
     */
    public async loadHints(levelId: string): Promise<void> {
        const hintService = HintService.getInstance();
        this._hints = await hintService.getHintsForLevel(levelId);
        log.info('[LevelHintSystem] Loaded', this._hints.length, 'hints');
    }

    /**
     * Subscribe to game events to trigger hints
     */
    public subscribeToEvents(
        shipStatus: ShipStatus,
        scoreObservable: Observable<ScoreEvent>,
        collisionObservable?: Observable<CollisionEvent>
    ): void {
        // Ship status changes (fuel, hull, ammo)
        this._statusObserver = shipStatus.onStatusChanged.add((event) => {
            this.handleStatusChange(event);
        });

        // Asteroid destroyed events
        this._scoreObserver = scoreObservable.add((event) => {
            this.handleScoreEvent(event);
        });

        // Collision events (optional)
        if (collisionObservable) {
            this._collisionObserver = collisionObservable.add((event) => {
                this.handleCollision(event);
            });
        }

        log.info('[LevelHintSystem] Subscribed to events');
    }

    /**
     * Handle ship status changes (fuel/hull/ammo thresholds)
     */
    private handleStatusChange(event: ShipStatusChangeEvent): void {
        const hints = this._hints.filter(h =>
            h.eventType === 'ship_status' &&
            h.eventConfig.status_type === event.statusType
        );

        for (const hint of hints) {
            const threshold = hint.eventConfig.threshold as number;
            const direction = hint.eventConfig.direction as string;
            const thresholdKey = `${hint.id}_${threshold}_${direction}`;

            // Check if threshold crossed
            let triggered = false;
            if (direction === 'below') {
                // Trigger when crossing below threshold
                if (event.oldValue > threshold && event.newValue <= threshold) {
                    triggered = true;
                }
            } else if (direction === 'above') {
                // Trigger when crossing above threshold
                if (event.oldValue < threshold && event.newValue >= threshold) {
                    triggered = true;
                }
            }

            if (triggered) {
                // For 'always' mode, check if we've already triggered this threshold
                if (hint.playMode === 'always') {
                    if (this._triggeredThresholds.has(thresholdKey)) {
                        continue; // Already triggered this session
                    }
                    this._triggeredThresholds.add(thresholdKey);
                }
                this.queueHint(hint);
            }
        }
    }

    /**
     * Handle asteroid destroyed events
     */
    private handleScoreEvent(event: ScoreEvent): void {
        if (event.score > 0) {
            this._asteroidsDestroyed++;

            const hints = this._hints.filter(h =>
                h.eventType === 'asteroid_destroyed' &&
                h.eventConfig.count === this._asteroidsDestroyed
            );

            for (const hint of hints) {
                this.queueHint(hint);
            }
        }
    }

    /**
     * Handle collision events
     */
    private handleCollision(event: CollisionEvent): void {
        const hints = this._hints.filter(h => {
            if (h.eventType !== 'collision') return false;
            const collisionType = h.eventConfig.collision_type as string;
            return collisionType === 'any' || collisionType === event.collisionType;
        });

        for (const hint of hints) {
            this.queueHint(hint);
        }
    }

    /**
     * Queue a hint for audio playback
     */
    private queueHint(hint: HintEntry): void {
        // Check if 'once' hint already played
        if (hint.playMode === 'once' && this._playedHints.has(hint.id)) {
            return;
        }

        // Mark as played
        if (hint.playMode === 'once') {
            this._playedHints.add(hint.id);
        }

        log.info('[LevelHintSystem] Queueing hint:', hint.id, hint.audioUrl);

        // Load and queue audio
        this._audioEngine.createSoundAsync(
            `hint_${hint.id}_${Date.now()}`,
            hint.audioUrl,
            { loop: false, volume: 2.0 }
        ).then(sound => {
            this._audioQueue.push(sound);
        }).catch(err => {
            log.error('[LevelHintSystem] Failed to load audio:', hint.audioUrl, err);
        });
    }

    /**
     * Process audio queue - call from game update loop
     */
    public update(): void {
        if (!this._isPlaying && this._audioQueue.length > 0) {
            const sound = this._audioQueue.shift()!;
            this._isPlaying = true;

            sound.onEndedObservable.add(() => {
                this._isPlaying = false;
                sound.dispose();
            });

            sound.play();
        }
    }

    /**
     * Clean up resources and unsubscribe from events
     */
    public dispose(): void {
        // Clear audio queue
        for (const sound of this._audioQueue) {
            sound.dispose();
        }
        this._audioQueue = [];

        // Clear state
        this._hints = [];
        this._playedHints.clear();
        this._triggeredThresholds.clear();
        this._asteroidsDestroyed = 0;
        this._isPlaying = false;

        // Note: Observers are cleaned up when the observables are disposed
        this._statusObserver = null;
        this._scoreObserver = null;
        this._collisionObserver = null;

        log.info('[LevelHintSystem] Disposed');
    }
}
