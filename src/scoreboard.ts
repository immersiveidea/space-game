import {AdvancedDynamicTexture, Control, StackPanel, TextBlock} from "@babylonjs/gui";
import {DefaultScene} from "./defaultScene";
import {
    Angle,
    MeshBuilder,
    Observable, StandardMaterial,
    Vector3,
} from "@babylonjs/core";
export type ScoreEvent = {
    score: number,
    message: string,
    remaining: number,
    timeRemaining? : number
}
export class Scoreboard {
    private _score: number = 0;
    private _remaining: number = 0;
    private _timeRemaining: number = 61;
    private _lastMessage: string = null;
    private _active = false;
    private _done = false;
    public readonly onScoreObservable: Observable<ScoreEvent> = new Observable<ScoreEvent>();
    constructor() {
        DefaultScene.MainScene.onNewMeshAddedObservable.add((mesh) => {
           if (mesh.id == 'RightUpperDisplay') {
               this.initialize();
           }
        });
    }
    public get done() {
        return this._done;
    }
    public set done(value: boolean) {
        this._done = value;
    }
    private initialize() {
        const scene = DefaultScene.MainScene;

        const parent = scene.getMeshById('RightUpperDisplay');
        const scoreboard = MeshBuilder.CreatePlane("scoreboard", {width: 1, height: 1}, scene);
        scoreboard.renderingGroupId = 3;
        const material = new StandardMaterial("scoreboard", scene);

        scoreboard.parent =parent;
        scoreboard.position.x = -.76;
        scoreboard.position.y = 4.19;
        scoreboard.position.z = .53;
        scoreboard.rotation.x = Angle.FromDegrees(104).radians();
        scoreboard.rotation.z = Math.PI;
        scoreboard.scaling = new Vector3(.3, .3, .3);

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
        timeRemainingText.text = 'Time: 2:00';

        const panel = new StackPanel();
        panel.isVertical = true;
        panel.height = 1;
        panel.isVertical = true;
        panel.addControl(scoreText);
        panel.addControl(remainingText);
        panel.addControl(fpsText);
        panel.addControl(hullText);
        panel.addControl(timeRemainingText);

        advancedTexture.addControl(panel);

        let i = 0;
        let lastSecond: number = Date.now();
        const afterRender = scene.onAfterRenderObservable.add(() => {
            scoreText.text = `Score: ${this.calculateScore()}`;
            remainingText.text = `Remaining: ${this._remaining}`;
            const now = Date.now();
            if (this._active && (Math.floor(lastSecond / 1000) < Math.floor(now/1000))) {
                this._timeRemaining--;
                if (this._timeRemaining <= 0) {
                    scene.onAfterRenderObservable.remove(afterRender);
                }
                lastSecond = now;
                timeRemainingText.text = `Time: ${Math.floor(this._timeRemaining/60).toString().padStart(2,"0")}:${(this._timeRemaining%60).toString().padStart(2,"0")}`;
            }
            if (i++%60 == 0) {
                fpsText.text = `FPS: ${Math.floor(scene.getEngine().getFps())}`;
            }
        });

        this.onScoreObservable.add((score: ScoreEvent) => {
            this._score += score.score * this._timeRemaining;
            this._remaining += score.remaining;
            this._lastMessage = score.message;
            if (score.timeRemaining) {
                this._timeRemaining = score.timeRemaining;
            }
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
}