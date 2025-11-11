import {
    AdvancedDynamicTexture,
    Button,
    Control,
    Rectangle,
    ScrollViewer,
    StackPanel,
    TextBlock
} from "@babylonjs/gui";
import { PhysicsStorage } from "./recording/physicsStorage";
import debugLog from "../core/debug";

/**
 * Recording info for display
 */
interface RecordingInfo {
    id: string;
    name: string;
    timestamp: number;
    duration: number;
    frameCount: number;
}

/**
 * Fullscreen UI for selecting a recording to replay
 */
export class ReplaySelectionScreen {
    private _texture: AdvancedDynamicTexture;
    private _scrollViewer: ScrollViewer;
    private _recordingsList: StackPanel;
    private _selectedRecording: string | null = null;
    private _playButton: Button;
    private _deleteButton: Button;

    private _onPlayCallback: (recordingId: string) => void;
    private _onCancelCallback: () => void;

    private _selectedContainer: Rectangle | null = null;

    constructor(onPlay: (recordingId: string) => void, onCancel: () => void) {
        this._onPlayCallback = onPlay;
        this._onCancelCallback = onCancel;
    }

    /**
     * Initialize and show the selection screen
     */
    public async initialize(): Promise<void> {
        this._texture = AdvancedDynamicTexture.CreateFullscreenUI("replaySelection");

        // Semi-transparent background
        const background = new Rectangle("background");
        background.width = "100%";
        background.height = "100%";
        background.background = "rgba(10, 10, 20, 0.95)";
        background.thickness = 0;
        this._texture.addControl(background);

        // Main panel
        const mainPanel = new Rectangle("mainPanel");
        mainPanel.width = "900px";
        mainPanel.height = "700px";
        mainPanel.thickness = 2;
        mainPanel.color = "#00ff88";
        mainPanel.background = "#1a1a2e";
        mainPanel.cornerRadius = 10;
        mainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this._texture.addControl(mainPanel);

        // Title
        const title = new TextBlock("title", "RECORDED SESSIONS");
        title.width = "100%";
        title.height = "80px";
        title.color = "#00ff88";
        title.fontSize = "40px";
        title.fontWeight = "bold";
        title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        title.top = "20px";
        mainPanel.addControl(title);

        // ScrollViewer for recordings list
        this._scrollViewer = new ScrollViewer("scrollViewer");
        this._scrollViewer.width = "840px";
        this._scrollViewer.height = "480px";
        this._scrollViewer.thickness = 1;
        this._scrollViewer.color = "#444";
        this._scrollViewer.background = "#0a0a1e";
        this._scrollViewer.top = "110px";
        this._scrollViewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        mainPanel.addControl(this._scrollViewer);

        // StackPanel inside ScrollViewer
        this._recordingsList = new StackPanel("recordingsList");
        this._recordingsList.width = "100%";
        this._recordingsList.isVertical = true;
        this._recordingsList.spacing = 10;
        this._recordingsList.paddingTop = "10px";
        this._recordingsList.paddingBottom = "10px";
        this._scrollViewer.addControl(this._recordingsList);

        // Bottom button bar
        this.createButtonBar(mainPanel);

        // Load recordings
        await this.loadRecordings();

        debugLog("ReplaySelectionScreen: Initialized");
    }

    /**
     * Create button bar at bottom
     */
    private createButtonBar(parent: Rectangle): void {
        const buttonBar = new StackPanel("buttonBar");
        buttonBar.isVertical = false;
        buttonBar.width = "100%";
        buttonBar.height = "80px";
        buttonBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        buttonBar.spacing = 20;
        buttonBar.paddingBottom = "20px";
        parent.addControl(buttonBar);

        // Play button
        this._playButton = Button.CreateSimpleButton("play", "▶ Play Selected");
        this._playButton.width = "200px";
        this._playButton.height = "50px";
        this._playButton.color = "white";
        this._playButton.background = "#00ff88";
        this._playButton.cornerRadius = 10;
        this._playButton.thickness = 0;
        this._playButton.fontSize = "20px";
        this._playButton.fontWeight = "bold";
        this._playButton.isEnabled = false; // Disabled until selection

        this._playButton.onPointerClickObservable.add(() => {
            if (this._selectedRecording) {
                this._onPlayCallback(this._selectedRecording);
            }
        });

        buttonBar.addControl(this._playButton);

        // Delete button
        this._deleteButton = Button.CreateSimpleButton("delete", "🗑 Delete");
        this._deleteButton.width = "150px";
        this._deleteButton.height = "50px";
        this._deleteButton.color = "white";
        this._deleteButton.background = "#cc3333";
        this._deleteButton.cornerRadius = 10;
        this._deleteButton.thickness = 0;
        this._deleteButton.fontSize = "18px";
        this._deleteButton.fontWeight = "bold";
        this._deleteButton.isEnabled = false; // Disabled until selection

        this._deleteButton.onPointerClickObservable.add(async () => {
            if (this._selectedRecording) {
                await this.deleteRecording(this._selectedRecording);
            }
        });

        buttonBar.addControl(this._deleteButton);

        // Cancel button
        const cancelButton = Button.CreateSimpleButton("cancel", "✕ Cancel");
        cancelButton.width = "150px";
        cancelButton.height = "50px";
        cancelButton.color = "white";
        cancelButton.background = "#555";
        cancelButton.cornerRadius = 10;
        cancelButton.thickness = 0;
        cancelButton.fontSize = "18px";
        cancelButton.fontWeight = "bold";

        cancelButton.onPointerClickObservable.add(() => {
            this._onCancelCallback();
        });

        buttonBar.addControl(cancelButton);
    }

    /**
     * Load recordings from IndexedDB
     */
    private async loadRecordings(): Promise<void> {
        const storage = new PhysicsStorage();
        await storage.initialize();
        const recordings = await storage.listRecordings();
        storage.close();

        if (recordings.length === 0) {
            this.showNoRecordingsMessage();
            return;
        }

        // Sort by timestamp (newest first)
        recordings.sort((a, b) => b.timestamp - a.timestamp);

        recordings.forEach(rec => {
            const item = this.createRecordingItem(rec);
            this._recordingsList.addControl(item);
        });

        debugLog(`ReplaySelectionScreen: Loaded ${recordings.length} recordings`);
    }

    /**
     * Show message when no recordings are available
     */
    private showNoRecordingsMessage(): void {
        const message = new TextBlock("noRecordings", "No recordings available yet.\n\nPlay the game to create recordings!");
        message.width = "100%";
        message.height = "200px";
        message.color = "#888";
        message.fontSize = "24px";
        message.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        message.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        message.textWrapping = true;
        this._recordingsList.addControl(message);
    }

    /**
     * Create a selectable recording item
     */
    private createRecordingItem(recording: RecordingInfo): Rectangle {
        const itemContainer = new Rectangle();
        itemContainer.width = "800px";
        itemContainer.height = "90px";
        itemContainer.thickness = 1;
        itemContainer.color = "#555";
        itemContainer.background = "#2a2a3e";
        itemContainer.cornerRadius = 5;
        itemContainer.isPointerBlocker = true;
        itemContainer.hoverCursor = "pointer";

        // Hover effect
        itemContainer.onPointerEnterObservable.add(() => {
            if (this._selectedRecording !== recording.id) {
                itemContainer.background = "#3a3a4e";
            }
        });

        itemContainer.onPointerOutObservable.add(() => {
            if (this._selectedRecording !== recording.id) {
                itemContainer.background = "#2a2a3e";
            }
        });

        // Click to select
        itemContainer.onPointerClickObservable.add(() => {
            this.selectRecording(recording.id, itemContainer);
        });

        // Content panel
        const contentPanel = new StackPanel();
        contentPanel.isVertical = true;
        contentPanel.width = "100%";
        contentPanel.paddingLeft = "20px";
        contentPanel.paddingRight = "20px";
        contentPanel.paddingTop = "10px";
        itemContainer.addControl(contentPanel);

        // Session name (first line) - Format session ID nicely
        const sessionName = this.formatSessionName(recording.name);
        const nameText = new TextBlock("name", sessionName);
        nameText.height = "30px";
        nameText.color = "#00ff88";
        nameText.fontSize = "20px";
        nameText.fontWeight = "bold";
        nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        contentPanel.addControl(nameText);

        // Details (second line)
        const date = new Date(recording.timestamp);
        const dateStr = date.toLocaleString();
        const durationStr = this.formatDuration(recording.duration);
        const detailsText = new TextBlock(
            "details",
            `📅 ${dateStr}  |  ⏱ ${durationStr}  |  📊 ${recording.frameCount} frames`
        );
        detailsText.height = "25px";
        detailsText.color = "#aaa";
        detailsText.fontSize = "16px";
        detailsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        contentPanel.addControl(detailsText);

        return itemContainer;
    }

    /**
     * Select a recording
     */
    private selectRecording(recordingId: string, container: Rectangle): void {
        // Deselect previous
        if (this._selectedContainer) {
            this._selectedContainer.background = "#2a2a3e";
            this._selectedContainer.color = "#555";
        }

        // Select new
        this._selectedRecording = recordingId;
        this._selectedContainer = container;
        container.background = "#00ff88";
        container.color = "#00ff88";

        // Enable buttons
        this._playButton.isEnabled = true;
        this._deleteButton.isEnabled = true;

        debugLog(`ReplaySelectionScreen: Selected recording ${recordingId}`);
    }

    /**
     * Delete a recording
     */
    private async deleteRecording(recordingId: string): Promise<void> {
        const storage = new PhysicsStorage();
        await storage.initialize();
        await storage.deleteRecording(recordingId);
        storage.close();

        debugLog(`ReplaySelectionScreen: Deleted recording ${recordingId}`);

        // Refresh list
        this._recordingsList.clearControls();
        this._selectedRecording = null;
        this._selectedContainer = null;
        this._playButton.isEnabled = false;
        this._deleteButton.isEnabled = false;

        await this.loadRecordings();
    }

    /**
     * Format session name for display
     */
    private formatSessionName(sessionId: string): string {
        // Convert "session-1762606365166" to "Session 2024-11-08 07:06"
        if (sessionId.startsWith('session-')) {
            const timestamp = parseInt(sessionId.replace('session-', ''));
            const date = new Date(timestamp);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `Session ${dateStr} ${timeStr}`;
        }
        return sessionId;
    }

    /**
     * Format duration for display
     */
    private formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    /**
     * Dispose of UI
     */
    public dispose(): void {
        this._texture.dispose();
        debugLog("ReplaySelectionScreen: Disposed");
    }
}
