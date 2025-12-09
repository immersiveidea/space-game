/**
 * BabylonJS Editor plugin entry point
 * Uses Editor v5 plugin API: main(), close(), title, description
 */
import { exportLevelConfig } from "./exporter";
import { createFloatingUI, destroyFloatingUI } from "./floatingUI";
import { initCameraSpeed, getSavedCameraSpeed, handleCameraSpeedChange } from "./cameraSpeed";
import { showNotification, copyToClipboard, downloadJson } from "./utils";
import { initAuth } from "./services/pluginAuth";
import { initCloudHandlers, handleBrowseOfficial, handleBrowseMyLevels, handleAuthChange } from "./cloudLevelHandlers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Editor = any;

let editorInstance: Editor;

export const title = "Space Game";
export const description = "Export/Import Space Game level configurations";

export async function main(editor: Editor): Promise<void> {
    editorInstance = editor;

    // Expose for debugging in DevTools
    (window as any).spaceGameEditor = editor;
    (window as any).exportSpaceGameLevel = handleExport;
    (window as any).exportSpaceGameLevelToClipboard = handleExportToClipboard;

    initCameraSpeed(editor);
    initCloudHandlers(getScene, editor);
    initAuth().catch((err) => console.warn("Auth init failed:", err));

    await createFloatingUI({
        onExport: handleExport,
        onExportClipboard: handleExportToClipboard,
        onApplyUniformScale: handleApplyUniformScale,
        onCameraSpeedChange: handleCameraSpeedChange,
        getCameraSpeed: getSavedCameraSpeed,
        onBrowseOfficial: handleBrowseOfficial,
        onBrowseMyLevels: handleBrowseMyLevels,
        onAuthChange: handleAuthChange,
    });

    console.log("Space Game plugin activated");
}

export function close(): void {
    destroyFloatingUI();
    console.log("Space Game plugin deactivated");
}

async function handleExport(): Promise<void> {
    try {
        const scene = getScene();
        if (!scene) {
            showNotification("No scene loaded", true);
            return;
        }
        const json = exportLevelConfig(scene);
        downloadJson(json, "level.json");
        showNotification("Level exported!");
    } catch (err) {
        console.error("Export error:", err);
        showNotification("Failed to export: " + (err as Error).message, true);
    }
}

async function handleExportToClipboard(): Promise<void> {
    try {
        const scene = getScene();
        if (!scene) {
            showNotification("No scene loaded", true);
            return;
        }
        const json = exportLevelConfig(scene);
        await copyToClipboard(json);
        showNotification("Copied to clipboard!");
    } catch (err) {
        console.error("Clipboard error:", err);
        showNotification("Failed to copy: " + (err as Error).message, true);
    }
}

function handleApplyUniformScale(scale: number): void {
    const selected = editorInstance?.layout?.inspector?.state?.editedObject;
    if (!selected?.scaling) {
        showNotification("Select a mesh first", true);
        return;
    }
    selected.scaling.x = scale;
    selected.scaling.y = scale;
    selected.scaling.z = scale;
    showNotification(`Scale set to ${scale}`);
}

function getScene() {
    const scene = editorInstance?.layout?.preview?.scene ?? editorInstance?.scene;
    console.log("getScene called - editor:", editorInstance, "scene:", scene);
    return scene;
}
