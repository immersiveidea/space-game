import { Engine } from "@babylonjs/core";
import { ReplaySelectionScreen } from "../../replay/ReplaySelectionScreen";
import { ReplayManager } from "../../replay/ReplayManager";
import debugLog from '../debug';

/**
 * Interface for Main class methods needed by the view replays handler
 */
export interface ViewReplaysContext {
    isStarted(): boolean;
    setStarted(value: boolean): void;
    initializeXR(): Promise<void>;
    getEngine(): Engine;
    getReplayManager(): ReplayManager | null;
    setReplayManager(manager: ReplayManager): void;
}

/**
 * Creates the view replays button click handler
 * @param context - Main instance implementing ViewReplaysContext
 * @returns Click handler function
 */
export function createViewReplaysHandler(context: ViewReplaysContext): () => Promise<void> {
    return async () => {
        debugLog('[Main] ========== VIEW REPLAYS BUTTON CLICKED ==========');

        // Initialize engine and physics if not already done
        if (!context.isStarted()) {
            context.setStarted(true);
            await context.initializeXR();
        }

        // Hide main menu
        const levelSelect = document.querySelector('#levelSelect') as HTMLElement;
        const appHeader = document.querySelector('#appHeader') as HTMLElement;

        if (levelSelect) {
            levelSelect.style.display = 'none';
        }
        if (appHeader) {
            appHeader.style.display = 'none';
        }

        // Show replay selection screen
        const selectionScreen = new ReplaySelectionScreen(
            async (recordingId: string) => {
                // Play callback - start replay
                debugLog(`[Main] Starting replay for recording: ${recordingId}`);
                selectionScreen.dispose();

                // Create replay manager if not exists
                let replayManager = context.getReplayManager();
                if (!replayManager) {
                    replayManager = new ReplayManager(
                        context.getEngine() as Engine,
                        () => {
                            // On exit callback - return to main menu
                            debugLog('[Main] Exiting replay, returning to menu');
                            if (levelSelect) {
                                levelSelect.style.display = 'block';
                            }
                            const appHeader = document.querySelector('#appHeader') as HTMLElement;
                            if (appHeader) {
                                appHeader.style.display = 'block';
                            }
                        }
                    );
                    context.setReplayManager(replayManager);
                }

                // Start replay
                await replayManager.startReplay(recordingId);
            },
            () => {
                // Cancel callback - return to main menu
                debugLog('[Main] Replay selection cancelled');
                selectionScreen.dispose();
                if (levelSelect) {
                    levelSelect.style.display = 'block';
                }
                const appHeader = document.querySelector('#appHeader') as HTMLElement;
                if (appHeader) {
                    appHeader.style.display = 'block';
                }
            }
        );

        await selectionScreen.initialize();
    };
}
