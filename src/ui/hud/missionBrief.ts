import {
    AdvancedDynamicTexture,
    Button,
    Control,
    Rectangle,
    StackPanel,
    TextBlock
} from "@babylonjs/gui";
import { DefaultScene } from "../../core/defaultScene";
import {Mesh, MeshBuilder, Vector3, Observable, Observer} from "@babylonjs/core";
import debugLog from '../../core/debug';
import { LevelConfig } from "../../levels/config/levelConfig";
import { LevelDirectoryEntry } from "../../levels/storage/levelRegistry";

/**
 * Mission brief display for VR
 * Shows mission objectives and start button on cockpit screen
 */
export class MissionBrief {
    private _advancedTexture: AdvancedDynamicTexture | null = null;
    private _container: Rectangle | null = null;
    private _isVisible: boolean = false;
    private _onStartCallback: (() => void) | null = null;
    private _triggerObserver: Observer<void> | null = null;

    /**
     * Initialize the mission brief as a fullscreen overlay
     */
    public initialize(): void {
        console.log('[MissionBrief] ========== INITIALIZE CALLED ==========');
        const scene = DefaultScene.MainScene;
        console.log('[MissionBrief] Scene exists:', !!scene);

        try {
            console.log('[MissionBrief] Initializing as fullscreen overlay');
            const mesh = MeshBuilder.CreatePlane('brief', {size: 2});
            console.log('[MissionBrief] Mesh created:', mesh.name, 'ID:', mesh.id);

            const ship = scene.getNodeById('Ship');
            console.log('[MissionBrief] Ship node found:', !!ship);

            if (!ship) {
                console.error('[MissionBrief] ERROR: Ship node not found! Cannot parent mission brief mesh.');
                return;
            }

            mesh.parent = ship;
            mesh.position = new Vector3(0,1,2.8);
            mesh.renderingGroupId = 3; // Same as status screen for consistent rendering
            mesh.metadata = { uiPickable: true }; // TAG: VR UI - allow pointer selection
            console.log('[MissionBrief] Mesh parented to ship at position:', mesh.position);
            console.log('[MissionBrief] Mesh absolute position:', mesh.getAbsolutePosition());
            console.log('[MissionBrief] Mesh scaling:', mesh.scaling);
            console.log('[MissionBrief] Mesh isEnabled:', mesh.isEnabled());
            console.log('[MissionBrief] Mesh isVisible:', mesh.isVisible);

            // Create fullscreen advanced texture (not attached to mesh)
            this._advancedTexture = AdvancedDynamicTexture.CreateForMesh(mesh);
            console.log('[MissionBrief] AdvancedDynamicTexture created for mesh');
            console.log('[MissionBrief] Texture dimensions:', this._advancedTexture.getSize());

            console.log('[MissionBrief] Fullscreen UI created');

            // Create main container - centered overlay
            this._container = new Rectangle("missionBriefContainer");
            this._container.width = "800px";
            this._container.height = "600px";
            this._container.thickness = 4;
            this._container.color = "#00ff00";
            this._container.background = "rgba(0, 0, 0, 0.95)";
            this._container.cornerRadius = 20;
            this._container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            this._container.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            this._advancedTexture.addControl(this._container);
            console.log('[MissionBrief] Container created and added to texture');

            // Initially hidden
            this._container.isVisible = false;
            console.log('[MissionBrief] Container initially hidden');

            console.log('[MissionBrief] ========== INITIALIZATION COMPLETE ==========');
        } catch (error) {
            console.error('[MissionBrief] !!!!! INITIALIZATION FAILED !!!!!', error);
            console.error('[MissionBrief] Error stack:', error?.stack);
        }
    }

    /**
     * Show mission brief with level information
     * @param levelConfig - Level configuration containing mission details
     * @param directoryEntry - Optional directory entry with mission brief details
     * @param triggerObservable - Observable that fires when trigger is pulled
     * @param onStart - Callback when start button is pressed
     */
    public show(levelConfig: LevelConfig, directoryEntry: LevelDirectoryEntry | null, triggerObservable: Observable<void>, onStart: () => void): void {
        console.log('[MissionBrief] ========== SHOW() CALLED ==========');
        console.log('[MissionBrief] Container exists:', !!this._container);
        console.log('[MissionBrief] AdvancedTexture exists:', !!this._advancedTexture);

        if (!this._container || !this._advancedTexture) {
            console.error('[MissionBrief] !!!!! CANNOT SHOW - NOT INITIALIZED !!!!!');
            console.error('[MissionBrief] Container:', this._container);
            console.error('[MissionBrief] AdvancedTexture:', this._advancedTexture);
            return;
        }

        console.log('[MissionBrief] Showing with config:', {
            difficulty: levelConfig.difficulty,
            description: levelConfig.metadata?.description,
            asteroidCount: levelConfig.asteroids?.length,
            hasDirectoryEntry: !!directoryEntry,
            missionBriefItems: directoryEntry?.missionBrief?.length || 0
        });

        this._onStartCallback = onStart;

        // Listen for trigger pulls to dismiss the mission brief
        this._triggerObserver = triggerObservable.add(() => {
            debugLog('[MissionBrief] Trigger pulled - dismissing mission brief');
            this.hide();
            if (this._onStartCallback) {
                this._onStartCallback();
            }
            // Remove observer after first trigger
            if (this._triggerObserver) {
                triggerObservable.remove(this._triggerObserver);
                this._triggerObserver = null;
            }
        });

        // Clear previous content
        this._container.children.forEach(child => child.dispose());
        this._container.clearControls();

        // Create content panel
        const contentPanel = new StackPanel("missionContent");
        contentPanel.width = "750px";
        contentPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        contentPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        contentPanel.paddingTop = "20px";
        contentPanel.paddingBottom = "20px";
        this._container.addControl(contentPanel);

        // Title
        const title = new TextBlock("missionTitle");
        title.text = "MISSION BRIEF";
        title.color = "#00ff00";
        title.fontSize = 48;
        title.fontWeight = "bold";
        title.height = "70px";
        title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        contentPanel.addControl(title);

        // Spacer
        const spacer1 = new Rectangle("spacer1");
        spacer1.height = "30px";
        spacer1.thickness = 0;
        contentPanel.addControl(spacer1);

        // Divider line
        const divider = new Rectangle("divider");
        divider.height = "3px";
        divider.width = "700px";
        divider.background = "#00ff00";
        divider.thickness = 0;
        contentPanel.addControl(divider);

        // Spacer
        const spacer2 = new Rectangle("spacer2");
        spacer2.height = "40px";
        spacer2.thickness = 0;
        contentPanel.addControl(spacer2);

        // Mission description
        const description = this.getMissionDescription(levelConfig, directoryEntry);
        const descriptionText = new TextBlock("missionDescription");
        descriptionText.text = description;
        descriptionText.color = "#ffffff";
        descriptionText.fontSize = 20;
        descriptionText.textWrapping = true;
        descriptionText.height = "150px";
        descriptionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        descriptionText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        contentPanel.addControl(descriptionText);

        // Objectives
        const objectives = this.getObjectives(levelConfig, directoryEntry);
        const objectivesText = new TextBlock("objectives");
        objectivesText.text = objectives;
        objectivesText.color = "#ffaa00";
        objectivesText.fontSize = 18;
        objectivesText.textWrapping = true;
        objectivesText.height = "200px";
        objectivesText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        objectivesText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        objectivesText.paddingLeft = "20px";
        contentPanel.addControl(objectivesText);

        // Spacer before button
        const spacer3 = new Rectangle("spacer3");
        spacer3.height = "40px";
        spacer3.thickness = 0;
        contentPanel.addControl(spacer3);

        // START button
        const startButton = Button.CreateSimpleButton("startButton", "START MISSION");
        startButton.width = "400px";
        startButton.height = "60px";
        startButton.color = "white";
        startButton.background = "#00ff88";
        startButton.cornerRadius = 10;
        startButton.thickness = 0;
        startButton.fontSize = "36px";
        startButton.fontWeight = "bold";
        startButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        startButton.onPointerClickObservable.add(() => {
            debugLog('[MissionBrief] START button clicked - dismissing mission brief');
            this.hide();
            if (this._onStartCallback) {
                this._onStartCallback();
            }
            // Remove trigger observer when button is clicked
            if (this._triggerObserver) {
                triggerObservable.remove(this._triggerObserver);
                this._triggerObserver = null;
            }
        });
        contentPanel.addControl(startButton);
        
        // Show the container
        this._container.isVisible = true;
        this._isVisible = true;

        console.log('[MissionBrief] ========== CONTAINER NOW VISIBLE ==========');
        console.log('[MissionBrief] Container.isVisible:', this._container.isVisible);
        console.log('[MissionBrief] _isVisible flag:', this._isVisible);
        console.log('[MissionBrief] Container children count:', this._container.children.length);
        console.log('[MissionBrief] AdvancedTexture control count:', this._advancedTexture.rootContainer.children.length);
        console.log('[MissionBrief] ========== MISSION BRIEF DISPLAY COMPLETE ==========');
    }

    /**
     * Hide the mission brief
     */
    public hide(): void {
        if (this._container) {
            this._container.isVisible = false;
            this._isVisible = false;
            debugLog('[MissionBrief] Mission brief hidden');
        }
    }

    /**
     * Check if mission brief is currently visible
     */
    public get isVisible(): boolean {
        return this._isVisible;
    }

    /**
     * Get mission description text based on level config and directory entry
     */
    private getMissionDescription(levelConfig: LevelConfig, directoryEntry: LevelDirectoryEntry | null): string {
        const difficulty = levelConfig.difficulty.toUpperCase();
        const name = directoryEntry?.name || levelConfig.metadata?.description || "Mission";
        const description = directoryEntry?.description || "Clear the asteroid field";
        const estimatedTime = directoryEntry?.estimatedTime || "Unknown";

        return `${name}\n` +
               `Difficulty: ${difficulty}\n` +
               `Estimated Time: ${estimatedTime}\n\n` +
               `${description}`;
    }

    /**
     * Get objectives text based on level config and directory entry
     */
    private getObjectives(levelConfig: LevelConfig, directoryEntry: LevelDirectoryEntry | null): string {
        const asteroidCount = levelConfig.asteroids?.length || 0;

        // Use mission brief from directory if available
        if (directoryEntry?.missionBrief && directoryEntry.missionBrief.length > 0) {
            const objectives = directoryEntry.missionBrief
                .map(item => `• ${item}`)
                .join('\n');
            return `OBJECTIVES:\n${objectives}`;
        }

        // Fallback to default objectives
        return `OBJECTIVES:\n` +
               `• Destroy all ${asteroidCount} asteroids\n` +
               `• Manage fuel and ammunition\n` +
               `• Return to base safely`;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        if (this._advancedTexture) {
            this._advancedTexture.dispose();
            this._advancedTexture = null;
        }
        this._container = null;
        this._onStartCallback = null;
        this._triggerObserver = null;
        this._isVisible = false;
        debugLog('[MissionBrief] Disposed');
    }
}
