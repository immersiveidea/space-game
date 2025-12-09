/**
 * Handlers for cloud level browsing and loading
 */
import { getOfficialLevels, getMyLevels, saveLevel, CloudLevelEntry } from "./services/pluginLevelService";
import { showLevelBrowserModal, closeLevelBrowserModal } from "./levelBrowser/levelBrowserModal";
import { showSaveLevelModal, closeSaveLevelModal } from "./levelBrowser/saveLevelModal";
import { updateAuthSection } from "./levelBrowser/authStatus";
import { importLevelConfig } from "./levelImporter";
import { exportLevelConfig } from "./exporter";
import { showNotification } from "./utils";
import { isAuthenticated } from "./services/pluginAuth";
import { Scene } from "@babylonjs/core/scene";

let sceneGetter: () => Scene | null = () => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let editorRef: any = null;

export function initCloudHandlers(getScene: () => Scene | null, editor: unknown): void {
    sceneGetter = getScene;
    editorRef = editor;
}

export async function handleBrowseOfficial(): Promise<void> {
    try {
        showNotification("Loading levels...");
        const levels = await getOfficialLevels();
        showLevelBrowserModal(levels, "Official Levels", {
            onSelectLevel: handleLoadLevel,
            onClose: closeLevelBrowserModal,
        });
    } catch (err) {
        console.error("Browse official error:", err);
        showNotification("Failed to fetch levels", true);
    }
}

export async function handleBrowseMyLevels(): Promise<void> {
    if (!isAuthenticated()) {
        showNotification("Sign in to view your levels", true);
        return;
    }

    try {
        showNotification("Loading levels...");
        const levels = await getMyLevels();
        showLevelBrowserModal(levels, "My Levels", {
            onSelectLevel: handleLoadLevel,
            onClose: closeLevelBrowserModal,
            onSaveNew: handleSaveNewLevel,
            onSaveExisting: handleSaveExistingLevel,
        });
    } catch (err) {
        console.error("Browse my levels error:", err);
        showNotification("Failed to fetch levels", true);
    }
}

export function handleAuthChange(): void {
    const authSection = document.getElementById("auth-status-section");
    if (authSection) {
        updateAuthSection(authSection, handleAuthChange);
    }
}

function handleLoadLevel(level: CloudLevelEntry): void {
    const scene = sceneGetter();
    if (!scene) {
        showNotification("No scene loaded", true);
        return;
    }

    try {
        closeLevelBrowserModal();
        showNotification(`Loading: ${level.name}...`);
        importLevelConfig(scene, level.config, () => {
            refreshEditorGraph();
            showNotification(`Loaded: ${level.name}`);
        });
    } catch (err) {
        console.error("Import error:", err);
        showNotification("Failed to import level", true);
    }
}

function handleSaveNewLevel(): void {
    closeLevelBrowserModal();
    showSaveLevelModal(
        async ({ name, difficulty }) => {
            const scene = sceneGetter();
            if (!scene) {
                showNotification("No scene loaded", true);
                closeSaveLevelModal();
                return;
            }

            try {
                showNotification("Saving level...");
                const configJson = exportLevelConfig(scene);
                const config = JSON.parse(configJson);
                const levelId = await saveLevel(name, difficulty, config);

                closeSaveLevelModal();
                if (levelId) {
                    showNotification(`Saved: ${name}`);
                } else {
                    showNotification("Failed to save level", true);
                }
            } catch (err) {
                console.error("Save error:", err);
                showNotification("Failed to save level", true);
                closeSaveLevelModal();
            }
        },
        closeSaveLevelModal
    );
}

async function handleSaveExistingLevel(level: CloudLevelEntry): Promise<void> {
    const scene = sceneGetter();
    if (!scene) {
        showNotification("No scene loaded", true);
        return;
    }

    try {
        showNotification(`Saving ${level.name}...`);
        const configJson = exportLevelConfig(scene);
        const config = JSON.parse(configJson);
        const result = await saveLevel(level.name, level.difficulty, config, level.id);

        if (result) {
            showNotification(`Saved: ${level.name}`);
        } else {
            showNotification("Failed to save level", true);
        }
    } catch (err) {
        console.error("Save error:", err);
        showNotification("Failed to save level", true);
    }
}

function refreshEditorGraph(): void {
    try {
        editorRef?.layout?.graph?.refresh?.();
        editorRef?.layout?.preview?.forceUpdate?.();
    } catch (err) {
        console.warn("Could not refresh editor graph:", err);
    }
}
