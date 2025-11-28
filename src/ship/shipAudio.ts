import type { AudioEngineV2, StaticSound } from "@babylonjs/core";

/**
 * Manages ship audio (thrust sounds and weapon fire)
 */
export class ShipAudio {
    private _audioEngine: AudioEngineV2;
    private _primaryThrustSound: StaticSound;
    private _secondaryThrustSound: StaticSound;
    private _weaponSound: StaticSound;
    private _collisionSound: StaticSound;
    private _primaryThrustPlaying: boolean = false;
    private _secondaryThrustPlaying: boolean = false;

    constructor(audioEngine?: AudioEngineV2) {
        this._audioEngine = audioEngine;
    }

    /**
     * Initialize sound assets
     */
    public async initialize(): Promise<void> {
        if (!this._audioEngine) return;

        this._primaryThrustSound = await this._audioEngine.createSoundAsync(
            "thrust",
            "/assets/themes/default/audio/thrust5.mp3",
            {
                loop: true,
                volume: 0.2,
            }
        );

        this._secondaryThrustSound = await this._audioEngine.createSoundAsync(
            "thrust2",
            "/assets/themes/default/audio/thrust5.mp3",
            {
                loop: true,
                volume: 0.5,
            }
        );

        this._weaponSound = await this._audioEngine.createSoundAsync(
            "shot",
            "/assets/themes/default/audio/shot.mp3",
            {
                loop: false,
                volume: 0.5,
            }
        );

        this._collisionSound = await this._audioEngine.createSoundAsync(
            "collision",
            "/assets/themes/default/audio/collision.mp3",
            {
                loop: false,
                volume: 0.25,
            }
        );
    }

    /**
     * Update thrust audio based on current force magnitudes
     * @param linearMagnitude - Forward/backward thrust magnitude (0-1)
     * @param angularMagnitude - Rotation thrust magnitude (0-3)
     */
    public updateThrustAudio(
        linearMagnitude: number,
        angularMagnitude: number
    ): void {
        // Handle primary thrust sound (forward/backward movement)
        if (linearMagnitude > 0) {
            if (this._primaryThrustSound && !this._primaryThrustPlaying) {
                this._primaryThrustSound.play();
                this._primaryThrustPlaying = true;
            }
            if (this._primaryThrustSound) {
                this._primaryThrustSound.volume = linearMagnitude;
            }
        } else {
            if (this._primaryThrustSound && this._primaryThrustPlaying) {
                this._primaryThrustSound.stop();
                this._primaryThrustPlaying = false;
            }
        }

        // Handle secondary thrust sound (rotation)
        if (angularMagnitude > 0.1) {
            if (this._secondaryThrustSound && !this._secondaryThrustPlaying) {
                this._secondaryThrustSound.play();
                this._secondaryThrustPlaying = true;
            }
            if (this._secondaryThrustSound) {
                this._secondaryThrustSound.volume = angularMagnitude * 0.4;
            }
        } else {
            if (this._secondaryThrustSound && this._secondaryThrustPlaying) {
                this._secondaryThrustSound.stop();
                this._secondaryThrustPlaying = false;
            }
        }
    }

    /**
     * Play weapon fire sound
     */
    public playWeaponSound(): void {
        this._weaponSound?.play();
    }

    /**
     * Play collision sound
     */
    public playCollisionSound(): void {
        this._collisionSound?.play();
    }

    /**
     * Cleanup audio resources
     */
    public dispose(): void {
        this._primaryThrustSound?.dispose();
        this._secondaryThrustSound?.dispose();
        this._weaponSound?.dispose();
        this._collisionSound?.dispose();
    }
}
