import {AdvancedDynamicTexture, Control, StackPanel, TextBlock, Rectangle, Container} from "@babylonjs/gui";
import {DefaultScene} from "../../core/defaultScene";
import {
    Mesh,
    MeshBuilder,
    Observable,
    Vector3,
} from "@babylonjs/core";
import log from '../../core/logger';
import { ShipStatus } from '../../ship/shipStatus';

export type ScoreEvent = {
    score: number,
    message: string,
    remaining: number,
    timeRemaining? : number
}
export class Scoreboard {
    private _score: number = 0;
    private _remaining: number = 0;
    private _initialAsteroidCount: number = 0;
    private _startTime: number = Date.now();

    private _active = false;
    private _done = false;
    public readonly onScoreObservable: Observable<ScoreEvent> = new Observable<ScoreEvent>();

    // Gauge bar fill rectangles
    private _fuelBar: Rectangle | null = null;
    private _hullBar: Rectangle | null = null;
    private _ammoBar: Rectangle | null = null;

    // Ship status manager
    private _shipStatus: ShipStatus;

    // Reference to ship for velocity reading
    private _ship: any = null;

    constructor() {
        this._shipStatus = new ShipStatus();

        // Subscribe to status changes to automatically update gauges
        this._shipStatus.onStatusChanged.add((event) => {
            switch (event.statusType) {
                case 'fuel':
                    this.updateFuelBar(event.newValue);
                    break;
                case 'hull':
                    this.updateHullBar(event.newValue);
                    break;
                case 'ammo':
                    this.updateAmmoBar(event.newValue);
                    break;
            }
        });
    }
    public get done() {
        return this._done;
    }
    public set done(value: boolean) {
        this._done = value;
    }

    /**
     * Get the ship status manager
     */
    public get shipStatus(): ShipStatus {
        return this._shipStatus;
    }

    /**
     * Get the number of asteroids remaining
     */
    public get remaining(): number {
        return this._remaining;
    }

    public setRemainingCount(count: number) {
        this._remaining = count;
        // Track initial count for victory validation
        if (this._initialAsteroidCount === 0 && count > 0) {
            this._initialAsteroidCount = count;
        }
    }

    /**
     * Check if asteroids were properly initialized (count > 0)
     */
    public get hasAsteroidsToDestroy(): boolean {
        return this._initialAsteroidCount > 0;
    }

    /**
     * Set the ship reference for velocity reading
     */
    public setShip(ship: any): void {
        this._ship = ship;
    }

    public initialize(): void {
        const scene = DefaultScene.MainScene;

        const parent = scene.getNodeById('ship');
        log.debug('Scoreboard parent:', parent);
        log.debug('Initializing scoreboard');
        let scoreboard: Mesh | null = null;

        // Retrieve and setup screen mesh from the loaded GLB
        const screen = scene.getMaterialById("Screen")?.getBindedMeshes()[0] as Mesh;

        if (screen) {
            // Setup screen mesh: adjust pivot point and rotation
            const oldParent = screen.parent;
            screen.setParent(null);
            screen.setPivotPoint(screen.getBoundingInfo().boundingSphere.center);
            screen.setParent(oldParent);
            screen.rotation.y = Math.PI;

            scoreboard = screen;
            scoreboard.material.dispose();
        }

        // Retrieve and setup gauges mesh from the loaded GLB
        const gauges = scene.getMaterialById("Gauges")?.getBindedMeshes()[0] as Mesh;

        if (gauges) {
            // Setup gauges mesh: adjust pivot point and rotation
            const oldParent = gauges.parent;
            gauges.setParent(null);
            gauges.setPivotPoint(gauges.getBoundingInfo().boundingSphere.center);
            gauges.setParent(oldParent);
            //gauges.rotation.y = Math.PI;

            // Create gauges display
            this.createGaugesDisplay(gauges);
        }

        // Fallback: create a plane if screen mesh not found
        if (!scoreboard) {
            log.error('Screen mesh not found, creating fallback plane');
            scoreboard = MeshBuilder.CreatePlane("scoreboard", {width: 1, height: 1}, scene);
            scoreboard.parent = parent;

            scoreboard.position.y = 1.05;
            scoreboard.position.z = 2.1;
            scoreboard.visibility = .5;
            scoreboard.scaling = new Vector3(.4, .4, .4);
        }

        // scoreboard.renderingGroupId = 3;







        const advancedTexture = AdvancedDynamicTexture.CreateForMesh(scoreboard, 512, 512);
        advancedTexture.background = "black";
        advancedTexture.hasAlpha = false;
        const scoreText = this.createText();

        const fpsText = this.createText();
        fpsText.text = "FPS: 60";

        const hullText = this.createText();
        hullText.text = 'Hull: 100%';

        const remainingText = this.createText();
        remainingText.text = 'Remaining: 0';

        const timeRemainingText = this.createText();
        timeRemainingText.text = 'Time: 00:00';

        const velocityText = this.createText();
        velocityText.text = 'Velocity: 0 m/s';


        const panel = new StackPanel();
        panel.isVertical = true;
        //panel.height = .5;
        //panel.isVertical = true;
        panel.addControl(scoreText);
        panel.addControl(remainingText);
        panel.addControl(fpsText);
        panel.addControl(hullText);
        panel.addControl(timeRemainingText);
        panel.addControl(velocityText);
        advancedTexture.addControl(panel);
        let i = 0;
        const _afterRender = scene.onAfterRenderObservable.add(() => {
            if (i++ % 10 !== 0) return;

            scoreText.text = `Score: ${this.calculateScore()}`;
            remainingText.text = `Remaining: ${this._remaining}`;

            // Update velocity from ship if available
            if (this._ship && this._ship.velocity) {
                const velocityMagnitude = this._ship.velocity.length();
                velocityText.text = `Velocity: ${velocityMagnitude.toFixed(1)} m/s`;
            } else {
                velocityText.text = `Velocity: 0.0 m/s`;
            }

            const elapsed = Date.now() - this._startTime;
            if (this._active) {
                timeRemainingText.text = `Time: ${Math.floor(elapsed/60000).toString().padStart(2,"0")}:${(Math.floor(elapsed/1000)%60).toString().padStart(2,"0")}`;
                fpsText.text = `FPS: ${Math.floor(scene.getEngine().getFps())}`;
            }
        });

        this.onScoreObservable.add((score: ScoreEvent) => {
            this._score += score.score;
            this._remaining += score.remaining;
        });

        this._active = true;
    }
    private createText(): TextBlock {
        const text1 = new TextBlock();
        text1.color = "white";
        text1.fontSize = "60px";
        text1.height = "80px";
        text1.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        text1.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        return text1;
    }
    private calculateScore() {
        return Math.floor(this._score);
    }

    /**
     * Create the gauges display with 3 bar gauges (Fuel, Hull, Ammo)
     */
    private createGaugesDisplay(gaugesMesh: Mesh): void {
        // Store reference to old material to dispose after new one is created
        const oldMaterial = gaugesMesh.material;

        // Create AdvancedDynamicTexture for the gauges mesh
        // This creates a new StandardMaterial and assigns it to the mesh
        const gaugesTexture = AdvancedDynamicTexture.CreateForMesh(gaugesMesh, 512, 512);
        gaugesTexture.coordinatesIndex = 2;



        gaugesTexture.background = "#444444";
        gaugesTexture.hasAlpha = false;

        // Now dispose the old material after the new one is assigned
        if (oldMaterial) {
            oldMaterial.dispose(true, true);
        }

        log.debug('Gauges texture created, material:', gaugesMesh.material?.name);

        // Create a vertical stack panel for the gauges
        const panel = new StackPanel('GaugesPanel');
        panel.rotation = Math.PI;
        panel.isVertical = true;
        panel.width = "100%";
        panel.height = "100%";

        // Create the three gauges
        this._fuelBar = this.createGaugeBar("FUEL", "#00FF00", panel);
        this._hullBar = this.createGaugeBar("HULL", "#00FF00", panel);
        this._ammoBar = this.createGaugeBar("AMMO", "#00FF00", panel);

        gaugesTexture.addControl(panel);

        let _i = 0;
        // Force the texture to update
        //gaugesTexture.markAsDirty();

        // Set initial values to full (for testing visibility)
        this._shipStatus.setFuel(1);
        this._shipStatus.setHull(1);
        this._shipStatus.setAmmo(1);

        log.debug('Gauges display created with initial test values');
    }

    /**
     * Create a single gauge bar with label
     */
    private createGaugeBar(label: string, color: string, parent: Container): Rectangle {
        // Container for this gauge (label + bar)
        const gaugeContainer = new StackPanel();
        gaugeContainer.isVertical = true;
        gaugeContainer.height = "140px";
        gaugeContainer.width = "100%";
        gaugeContainer.paddingBottom = "15px";

        // Label text
        const labelText = new TextBlock();
        labelText.text = label;
        labelText.color = "#FFFFFF";
        labelText.fontSize = "60px";
        labelText.height = "70px";
        labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        gaugeContainer.addControl(labelText);

        // Bar background (border and empty space)
        const barBackground = new Rectangle();
        barBackground.height = "50px";
        barBackground.width = "100%";
        barBackground.thickness = 3;
        barBackground.color = "#FFFFFF";
        barBackground.background = "#333333";
        barBackground.cornerRadius = 5;

        // Bar fill (the actual gauge)
        const barFill = new Rectangle();
        barFill.height = "100%";
        barFill.width = "100%"; // Will be updated dynamically
        barFill.thickness = 0;
        barFill.background = color;
        barFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        barFill.cornerRadius = 3;

        barBackground.addControl(barFill);
        gaugeContainer.addControl(barBackground);

        parent.addControl(gaugeContainer);

        return barFill;
    }

    /**
     * Get bar color based on value with smooth gradient
     * Green (1.0) -> Yellow (0.5) -> Red (0.0)
     */
    private getBarColor(value: number): string {
        // Clamp value between 0 and 1
        value = Math.max(0, Math.min(1, value));

        let red: number, green: number;

        if (value >= 0.5) {
            // Interpolate from yellow (0.5) to green (1.0)
            // At 0.5: RGB(255, 255, 0) yellow
            // At 1.0: RGB(0, 255, 0) green
            const t = (value - 0.5) * 2; // 0 to 1 range
            red = Math.round(255 * (1 - t));
            green = 255;
        } else {
            // Interpolate from red (0.0) to yellow (0.5)
            // At 0.0: RGB(255, 0, 0) red
            // At 0.5: RGB(255, 255, 0) yellow
            const t = value * 2; // 0 to 1 range
            red = 255;
            green = Math.round(255 * t);
        }

        // Convert to hex
        const redHex = red.toString(16).padStart(2, '0');
        const greenHex = green.toString(16).padStart(2, '0');
        return `#${redHex}${greenHex}00`;
    }
    /**
     * Internal method to update fuel gauge bar
     */
    private updateFuelBar(value: number): void {
        if (this._fuelBar) {
            this._fuelBar.width = `${value * 100}%`;
            this._fuelBar.background = this.getBarColor(value);
        }
    }

    /**
     * Internal method to update hull gauge bar
     */
    private updateHullBar(value: number): void {
        if (this._hullBar) {
            this._hullBar.width = `${value * 100}%`;
            this._hullBar.background = this.getBarColor(value);
        }
    }

    /**
     * Internal method to update ammo gauge bar
     */
    private updateAmmoBar(value: number): void {
        if (this._ammoBar) {
            this._ammoBar.width = `${value * 100}%`;
            this._ammoBar.background = this.getBarColor(value);
        }
    }

    /**
     * Dispose of scoreboard resources
     */
    public dispose(): void {
        if (this._shipStatus) {
            this._shipStatus.dispose();
        }
        this.onScoreObservable.clear();
    }
}