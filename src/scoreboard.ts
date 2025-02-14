import {AdvancedDynamicTexture, Control, StackPanel, TextBlock} from "@babylonjs/gui";
import {DefaultScene} from "./defaultScene";
import {
    AbstractMesh,
    ActionManager,
    Angle,
    ExecuteCodeAction,
    MeshBuilder,
    Observable,
    TransformNode,
    Vector3,
} from "@babylonjs/core";
import {ScoreEvent} from "./scoreEvent";

export class Scoreboard {
    private _score: number = 0;
    private _lastMessage: string = null;
    public onscoreObservable: Observable<ScoreEvent> = new Observable<ScoreEvent>();
    constructor() {
        DefaultScene.MainScene.onNewMeshAddedObservable.add((mesh) => {
           if (mesh.id == 'RightUpperDisplay') {
               window.setTimeout(() => {
                   //mesh.material = null;
                   this.initialize();
               },1000);

           }
        });
        //this.initialize(camera);
    }
    private initialize() {
        const scene = DefaultScene.MainScene;

        const parent = scene.getMeshById('RightUpperDisplay');
        const scoreboard = MeshBuilder.CreatePlane("scoreboard", {width: 1, height: 1}, scene);
        scoreboard.parent =parent;
        //DefaultScene.MainScene.onBeforeDrawPhaseObservable.add(() => {

        //});
        //scoreboard.parent = camera;
        scoreboard.position.x = -.76;
        scoreboard.position.y = 4.19;
        scoreboard.position.z = .53;
        scoreboard.rotation.x = Angle.FromDegrees(108).radians();
        scoreboard.rotation.z = Math.PI;
        scoreboard.scaling = new Vector3(.5, .5, .5);
        //scoreboard.position = camera.getFrontPosition(1);

        const advancedTexture = AdvancedDynamicTexture.CreateForMesh(scoreboard);
        advancedTexture.background = "black";
        const scoreText = this.createText();
        advancedTexture.addControl(scoreText);
        const fpsText = this.createText();
        fpsText.top = '120px';
        const panel = new StackPanel();
        panel.isVertical = true;
        advancedTexture.addControl(fpsText);
        advancedTexture.addControl(scoreText);
        advancedTexture.addControl(panel);

        scene.onAfterRenderObservable.add(() => {
            scoreText.text = `Score: ${this.calculateScore()}`;
            if (this._lastMessage != null) {
                fpsText.text = this._lastMessage;
            } else {
                fpsText.text = '';
            }

        });

        this.onscoreObservable.add((score) => {
            this._score += score.score;
            this._lastMessage = score.message;
        });
    }
    private createText(): TextBlock {
        const text1 = new TextBlock();

        text1.color = "white";
        text1.fontSize = 90;
        text1.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        text1.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        return text1;
    }
    private calculateScore() {
        return Math.floor(this._score);
    }
}