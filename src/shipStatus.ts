import { Observable } from "@babylonjs/core";

/**
 * Event data for ship status changes
 */
export interface ShipStatusChangeEvent {
    statusType: "fuel" | "hull" | "ammo";
    oldValue: number;
    newValue: number;
    delta: number;
}

/**
 * Ship status values container
 */
export interface ShipStatusValues {
    fuel: number;
    hull: number;
    ammo: number;
}

/**
 * Manages ship status values (fuel, hull integrity, ammo)
 * Provides observable events for changes and automatic clamping to 0-1 range
 */
export class ShipStatus {
    private _fuel: number = 1.0;
    private _hull: number = 1.0;
    private _ammo: number = 1.0;

    // Maximum values for each resource
    private _maxFuel: number = 1.0;
    private _maxHull: number = 1.0;
    private _maxAmmo: number = 1.0;

    // Observable for status changes
    public readonly onStatusChanged: Observable<ShipStatusChangeEvent> =
        new Observable<ShipStatusChangeEvent>();

    /**
     * Get current fuel level (0-1)
     */
    public get fuel(): number {
        return this._fuel;
    }

    /**
     * Get current hull integrity (0-1)
     */
    public get hull(): number {
        return this._hull;
    }

    /**
     * Get current ammo level (0-1)
     */
    public get ammo(): number {
        return this._ammo;
    }

    /**
     * Get all status values
     */
    public getValues(): ShipStatusValues {
        return {
            fuel: this._fuel,
            hull: this._hull,
            ammo: this._ammo,
        };
    }

    /**
     * Set fuel level directly (clamped to 0-1)
     */
    public setFuel(value: number): void {
        const oldValue = this._fuel;
        this._fuel = Math.max(0, Math.min(this._maxFuel, value));

        if (oldValue !== this._fuel) {
            this.onStatusChanged.notifyObservers({
                statusType: "fuel",
                oldValue,
                newValue: this._fuel,
                delta: this._fuel - oldValue,
            });
        }
    }

    /**
     * Set hull integrity directly (clamped to 0-1)
     */
    public setHull(value: number): void {
        const oldValue = this._hull;
        this._hull = Math.max(0, Math.min(this._maxHull, value));

        if (oldValue !== this._hull) {
            this.onStatusChanged.notifyObservers({
                statusType: "hull",
                oldValue,
                newValue: this._hull,
                delta: this._hull - oldValue,
            });
        }
    }

    /**
     * Set ammo level directly (clamped to 0-1)
     */
    public setAmmo(value: number): void {
        const oldValue = this._ammo;
        this._ammo = Math.max(0, Math.min(this._maxAmmo, value));

        if (oldValue !== this._ammo) {
            this.onStatusChanged.notifyObservers({
                statusType: "ammo",
                oldValue,
                newValue: this._ammo,
                delta: this._ammo - oldValue,
            });
        }
    }

    /**
     * Increment fuel by delta amount
     */
    public addFuel(delta: number): void {
        this.setFuel(this._fuel + delta);
    }

    /**
     * Decrement fuel by delta amount
     */
    public consumeFuel(delta: number): void {
        this.setFuel(this._fuel - delta);
    }

    /**
     * Damage hull by delta amount
     */
    public damageHull(delta: number): void {
        this.setHull(this._hull - delta);
    }

    /**
     * Repair hull by delta amount
     */
    public repairHull(delta: number): void {
        this.setHull(this._hull + delta);
    }

    /**
     * Increment ammo by delta amount
     */
    public addAmmo(delta: number): void {
        this.setAmmo(this._ammo + delta);
    }

    /**
     * Decrement ammo by delta amount (fire weapon)
     */
    public consumeAmmo(delta: number): void {
        this.setAmmo(this._ammo - delta);
    }

    /**
     * Check if fuel is depleted
     */
    public isFuelEmpty(): boolean {
        return this._fuel <= 0;
    }

    /**
     * Check if hull is destroyed
     */
    public isDestroyed(): boolean {
        return this._hull <= 0;
    }

    /**
     * Check if ammo is depleted
     */
    public isAmmoEmpty(): boolean {
        return this._ammo <= 0;
    }

    /**
     * Reset all values to full
     */
    public reset(): void {
        this.setFuel(this._maxFuel);
        this.setHull(this._maxHull);
        this.setAmmo(this._maxAmmo);
    }

    /**
     * Set maximum values for resources
     */
    public setMaxValues(fuel?: number, hull?: number, ammo?: number): void {
        if (fuel !== undefined) this._maxFuel = fuel;
        if (hull !== undefined) this._maxHull = hull;
        if (ammo !== undefined) this._maxAmmo = ammo;
    }

    /**
     * Dispose observables
     */
    public dispose(): void {
        this.onStatusChanged.clear();
    }
}
