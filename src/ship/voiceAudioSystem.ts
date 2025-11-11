import { AudioEngineV2, StaticSound, SoundState } from "@babylonjs/core";
import debugLog from "../core/debug";
import { ShipStatus, ShipStatusChangeEvent } from "./shipStatus";
import { ScoreEvent } from "../ui/hud/scoreboard";

/**
 * Priority levels for voice messages
 */
export enum VoiceMessagePriority {
    HIGH = 0,    // Critical warnings (danger, immediate action needed)
    NORMAL = 1,  // Standard warnings and status updates
    LOW = 2      // Informational messages
}

/**
 * Voice message to be queued
 */
interface VoiceMessage {
    sounds: string[];           // Array of sound names to play in sequence
    priority: VoiceMessagePriority;
    interrupt: boolean;         // If true, interrupt current playback
    repeatInterval?: number;    // Milliseconds between repeats (0 or undefined = no repeat)
    lastPlayedTime?: number;    // Timestamp when message was last played (for repeat timing)
}

/**
 * Manages voice audio system for cockpit computer announcements
 * Loads voice clips and plays them sequentially in response to game events
 */
export class VoiceAudioSystem {
    private _audioEngine: AudioEngineV2 | null = null;
    private _sounds: Map<string, StaticSound> = new Map();
    private _queue: VoiceMessage[] = [];
    private _currentMessage: VoiceMessage | null = null;
    private _currentSoundIndex: number = 0;
    private _isPlaying: boolean = false;

    // Track which warnings have been issued to prevent spam
    private _warningStates: Set<string> = new Set();

    // Available voice clips
    private readonly VOICE_FILES = [
        'warning',
        'danger',
        'fuel',
        'hull',
        'ammo',
        'full',
        'empty',
        'guns',
        'armed',
        'disarmed',
        'exitarm',
        'returntobase',
        'returncomplete'
    ];

    constructor() {
        // Constructor intentionally empty - initialization happens in initialize()
    }

    /**
     * Initialize voice audio system - load all voice clips
     * Call this AFTER audio engine is unlocked
     */
    public async initialize(audioEngine: AudioEngineV2): Promise<void> {
        this._audioEngine = audioEngine;

        debugLog('VoiceAudioSystem: Loading voice clips...');

        // Load all voice files as non-spatial sounds
        for (const fileName of this.VOICE_FILES) {
            try {
                const sound = await audioEngine.createSoundAsync(
                    `voice_${fileName}`,
                    `/assets/themes/default/audio/voice/${fileName}.mp3`,
                    {
                        loop: false,
                        volume: 0.8,
                        // Non-spatial - cockpit computer voice
                    }
                );
                this._sounds.set(fileName, sound);
            } catch (error) {
                debugLog(`VoiceAudioSystem: Failed to load ${fileName}.mp3`, error);
            }
        }

        debugLog(`VoiceAudioSystem: Loaded ${this._sounds.size}/${this.VOICE_FILES.length} voice clips`);
    }

    /**
     * Subscribe to game events to trigger voice messages
     */
    public subscribeToEvents(shipStatus: ShipStatus): void {
        // Subscribe to ship status changes
        shipStatus.onStatusChanged.add((event: ShipStatusChangeEvent) => {
            this.handleStatusChange(event);
        });

        debugLog('VoiceAudioSystem: Subscribed to game events');
    }

    /**
     * Handle ship status changes (fuel, hull, ammo)
     */
    private handleStatusChange(event: ShipStatusChangeEvent): void {
        const { statusType, newValue, delta } = event;
        const maxValue = 1;
        const percentage = maxValue > 0 ? newValue / maxValue : 0;
        debugLog(event);

        // Clear warning states if resources increase above thresholds
        if (delta > 0) {
            if (percentage >= 0.3) {
                this.clearWarningState(`warning_${statusType}`);
            }
            if (percentage >= 0.1) {
                this.clearWarningState(`danger_${statusType}`);
            }
            if (newValue > 0) {
                this.clearWarningState(`empty_${statusType}`);
            }
            return; // Don't trigger warnings on increases
        }


        if (percentage < 0.2 && !this._warningStates.has(`danger_${statusType}`)) {
            debugLog(`VoiceAudioSystem: DANGER warning triggered for ${statusType} (${(percentage * 100).toFixed(1)}%)`);
            this._warningStates.add(`danger_${statusType}`);
            // Clear warning state if it exists (danger supersedes warning)
            this.clearWarningState(`warning_${statusType}`);
            this.queueMessage(['danger', statusType], VoiceMessagePriority.HIGH, false, 2000);
        }
        // Warning (10% <= x < 30%) - repeat every 4 seconds ONLY if not in danger
        else if (percentage >= 0.2 && percentage < 0.5 && !this._warningStates.has(`warning_${statusType}`) && !this._warningStates.has(`danger_${statusType}`)) {
            debugLog(`VoiceAudioSystem: Warning triggered for ${statusType} (${(percentage * 100).toFixed(1)}%)`);
            this._warningStates.add(`warning_${statusType}`);
            this.queueMessage(['warning', statusType], VoiceMessagePriority.NORMAL, false, 4000);
        }
        // Empty (= 0) - no repeat
        else if (newValue === 0 && !this._warningStates.has(`empty_${statusType}`)) {
            debugLog(`VoiceAudioSystem: EMPTY warning triggered for ${statusType}`);
            this._warningStates.add(`empty_${statusType}`);
            this.queueMessage([statusType, 'empty'], VoiceMessagePriority.HIGH, false);
        }
    }


    /**
     * Queue a voice message to be played
     */
    public queueMessage(
        sounds: string[],
        priority: VoiceMessagePriority = VoiceMessagePriority.NORMAL,
        interrupt: boolean = false,
        repeatInterval: number = 0
    ): void {
        if (!this._audioEngine) {
            debugLog('VoiceAudioSystem: Cannot queue message - audio not initialized');
            return;
        }

        const message: VoiceMessage = {
            sounds,
            priority,
            interrupt,
            repeatInterval: repeatInterval > 0 ? repeatInterval : undefined
        };

        // If interrupt flag is set, stop current playback and clear queue
        if (interrupt) {
            this.stopCurrent();
            this._queue = [];
        }

        // Insert into queue based on priority (lower priority number = higher priority)
        const insertIndex = this._queue.findIndex(m => m.priority > priority);
        if (insertIndex === -1) {
            this._queue.push(message);
        } else {
            this._queue.splice(insertIndex, 0, message);
        }

        const repeatInfo = repeatInterval > 0 ? ` (repeat every ${repeatInterval}ms)` : '';
        debugLog(`VoiceAudioSystem: Queued message [${sounds.join(', ')}] with priority ${priority}${repeatInfo}`);
    }

    /**
     * Play a message immediately, interrupting current playback
     */
    public playImmediate(sounds: string[]): void {
        this.queueMessage(sounds, VoiceMessagePriority.HIGH, true);
    }

    /**
     * Update loop - call this every frame
     * Checks if current sound finished and plays next in sequence
     */
    public update(): void {
        if (!this._audioEngine) {
            return;
        }

        // If currently playing, check if sound finished
        if (this._isPlaying && this._currentMessage) {
            const currentSoundName = this._currentMessage.sounds[this._currentSoundIndex];
            const currentSound = this._sounds.get(currentSoundName);

            if (currentSound) {
                const state = currentSound.state;

                // Check if sound finished playing
                if (state !== SoundState.Started && state !== SoundState.Starting) {
                    // Move to next sound in sequence
                    this._currentSoundIndex++;

                    if (this._currentSoundIndex < this._currentMessage.sounds.length) {
                        // Play next sound in sequence
                        this.playCurrentSound();
                    } else {
                        // Sequence complete
                        debugLog('VoiceAudioSystem: Sequence complete');

                        // Check if this message should repeat
                        if (this._currentMessage.repeatInterval && this._currentMessage.repeatInterval > 0) {
                            // Record the time this message finished
                            this._currentMessage.lastPlayedTime = performance.now();

                            // Re-queue the message for repeat
                            this._queue.push({ ...this._currentMessage });
                            debugLog(`VoiceAudioSystem: Message re-queued for repeat in ${this._currentMessage.repeatInterval}ms`);
                        }

                        this._isPlaying = false;
                        this._currentMessage = null;
                        this._currentSoundIndex = 0;
                    }
                }
            }
        }

        // If not playing and queue has messages, start next message
        if (!this._isPlaying && this._queue.length > 0) {
            // Check if the first message in queue needs to wait for repeat interval
            const nextMessage = this._queue[0];
            if (nextMessage.lastPlayedTime && nextMessage.repeatInterval) {
                const now = performance.now();
                const timeSinceLastPlay = now - nextMessage.lastPlayedTime;

                if (timeSinceLastPlay < nextMessage.repeatInterval) {
                    // Not enough time has passed, skip this frame
                    return;
                }
            }

            // Ready to play - dequeue and start
            this._currentMessage = this._queue.shift()!;
            this._currentSoundIndex = 0;
            this._isPlaying = true;
            debugLog(`VoiceAudioSystem: Starting sequence [${this._currentMessage.sounds.join(' → ')}]`);
            this.playCurrentSound();
        }
    }

    /**
     * Play the current sound in the current message
     */
    private playCurrentSound(): void {
        if (!this._currentMessage) {
            return;
        }

        const soundName = this._currentMessage.sounds[this._currentSoundIndex];
        const sound = this._sounds.get(soundName);

        if (sound) {
            sound.play();
            debugLog(`VoiceAudioSystem: Playing ${soundName} (${this._currentSoundIndex + 1}/${this._currentMessage.sounds.length})`);
        } else {
            debugLog(`VoiceAudioSystem: Sound ${soundName} not found, skipping`);
            // Skip to next sound
            this._currentSoundIndex++;
        }
    }

    /**
     * Stop current playback
     */
    private stopCurrent(): void {
        if (this._currentMessage && this._currentSoundIndex < this._currentMessage.sounds.length) {
            const currentSoundName = this._currentMessage.sounds[this._currentSoundIndex];
            const currentSound = this._sounds.get(currentSoundName);

            if (currentSound && (currentSound.state === SoundState.Started || currentSound.state === SoundState.Starting)) {
                currentSound.stop();
            }
        }

        this._isPlaying = false;
        this._currentMessage = null;
        this._currentSoundIndex = 0;
    }

    /**
     * Clear all queued messages
     */
    public clearQueue(): void {
        this._queue = [];
        debugLog('VoiceAudioSystem: Queue cleared');
    }

    /**
     * Clear a specific warning state (allows warning to re-trigger)
     */
    public clearWarningState(key: string): void {
        if (this._warningStates.has(key)) {
            this._warningStates.delete(key);
            debugLog(`VoiceAudioSystem: Cleared warning state '${key}'`);
        }
    }

    /**
     * Reset warning states (useful when starting new level or respawning)
     */
    public resetWarningStates(): void {
        this._warningStates.clear();
        debugLog('VoiceAudioSystem: Warning states reset');
    }

    /**
     * Dispose of voice audio system
     */
    public dispose(): void {
        this.stopCurrent();
        this.clearQueue();
        this._sounds.clear();
        this._warningStates.clear();
        debugLog('VoiceAudioSystem: Disposed');
    }
}
