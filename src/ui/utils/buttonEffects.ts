import { Button } from "@babylonjs/gui";

/**
 * Adds a prominent hover effect to a BabylonJS GUI button
 * @param button - The button to add hover effects to
 * @param baseBackground - The base background color (default: #00ff88)
 * @param hoverBackground - The hover background color (default: #00ffaa)
 */
export function addButtonHoverEffect(
    button: Button,
    baseBackground: string = "#00ff88",
    hoverBackground: string = "#00ffaa"
): void {
    button.onPointerEnterObservable.add(() => {
        button.background = hoverBackground;
        button.scaleX = 1.05;
        button.scaleY = 1.05;
        button.thickness = 3;
        button.color = "#ffffff";
    });

    button.onPointerOutObservable.add(() => {
        button.background = baseBackground;
        button.scaleX = 1;
        button.scaleY = 1;
        button.thickness = 0;
        button.color = "white";
    });
}
