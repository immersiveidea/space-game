/**
 * Camera speed persistence and application
 */
import { showNotification } from "./utils";

const CAMERA_SPEED_KEY = "space-game-camera-speed";
const DEFAULT_CAMERA_SPEED = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let editorRef: any = null;

export function initCameraSpeed(editor: any): void {
    editorRef = editor;
    applyCameraSpeed(getSavedCameraSpeed());
}

export function getSavedCameraSpeed(): number {
    const saved = localStorage.getItem(CAMERA_SPEED_KEY);
    return saved ? parseFloat(saved) : DEFAULT_CAMERA_SPEED;
}

export function saveCameraSpeed(speed: number): void {
    localStorage.setItem(CAMERA_SPEED_KEY, String(speed));
}

export function applyCameraSpeed(speed: number): void {
    const camera = editorRef?.layout?.preview?.camera;
    if (camera) {
        camera.speed = speed;
    }
}

export function handleCameraSpeedChange(speed: number): void {
    saveCameraSpeed(speed);
    applyCameraSpeed(speed);
    showNotification(`Camera speed set to ${speed}`);
}
