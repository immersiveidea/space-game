import { Engine } from "@babylonjs/core";
import { DefaultScene } from "./defaultScene";
import { RockFactory } from "../environment/asteroids/rockFactory";
import debugLog from './debug';
import Level from "../levels/level";

export interface CleanupContext {
    getEngine(): Engine;
    getCurrentLevel(): Level | null;
    setCurrentLevel(level: Level | null): void;
    resetState(): void;
}

/**
 * Gracefully shutdown the game, disposing all resources
 */
export async function cleanupAndExit(
    context: CleanupContext,
    canvas: HTMLCanvasElement
): Promise<void> {
    debugLog('[Main] cleanupAndExit() called - starting graceful shutdown');
    try {
        context.getEngine().stopRenderLoop();
        disposeCurrentLevel(context);
        RockFactory.reset();
        await exitXRSession();
        disposeSceneResources();
        disablePhysics();
        context.resetState();
        clearCanvas(canvas);
    } catch (error) {
        console.error('[Main] Cleanup failed:', error);
        window.location.reload();
    }
}

function disposeCurrentLevel(context: CleanupContext): void {
    const level = context.getCurrentLevel();
    if (level) {
        level.dispose();
        context.setCurrentLevel(null);
    }
}

async function exitXRSession(): Promise<void> {
    if (DefaultScene.XR?.baseExperience.state === 2) {
        try {
            await DefaultScene.XR.baseExperience.exitXRAsync();
        } catch (error) {
            debugLog('[Main] Error exiting XR:', error);
        }
    }
    DefaultScene.XR = null;
}

function disposeSceneResources(): void {
    if (!DefaultScene.MainScene) return;
    DefaultScene.MainScene.meshes.slice().forEach(m => {
        if (!m.isDisposed()) m.dispose();
    });
    DefaultScene.MainScene.materials.slice().forEach(m => m.dispose());
}

function disablePhysics(): void {
    if (DefaultScene.MainScene?.isPhysicsEnabled()) {
        DefaultScene.MainScene.disablePhysicsEngine();
    }
}

function clearCanvas(canvas: HTMLCanvasElement): void {
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (gl) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
}
