/**
 * Floating UI panel for Space Game plugin
 */
import { createContent } from "./panelSections";

const PANEL_ID = "space-game-plugin-panel";

let panelElement: HTMLDivElement | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

export interface FloatingUICallbacks {
    onExport: () => void;
    onExportClipboard: () => void;
    onApplyUniformScale: (scale: number) => void;
    onCameraSpeedChange: (multiplier: number) => void;
    getCameraSpeed: () => number;
    onBrowseOfficial: () => void;
    onBrowseMyLevels: () => void;
    onAuthChange: () => void;
}

export async function createFloatingUI(callbacks: FloatingUICallbacks): Promise<void> {
    if (document.getElementById(PANEL_ID)) return;

    panelElement = document.createElement("div");
    panelElement.id = PANEL_ID;
    applyPanelStyles(panelElement);

    const header = createHeader();
    const content = await createContent(callbacks);

    panelElement.appendChild(header);
    panelElement.appendChild(content);
    document.body.appendChild(panelElement);

    setupDragHandlers(header);
}

export function destroyFloatingUI(): void {
    document.getElementById(PANEL_ID)?.remove();
    panelElement = null;
}

function applyPanelStyles(panel: HTMLDivElement): void {
    Object.assign(panel.style, {
        position: "fixed", top: "80px", right: "20px", width: "200px",
        backgroundColor: "#1e1e1e", border: "1px solid #3c3c3c", borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)", zIndex: "10000",
        fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "13px",
        color: "#e0e0e0", overflow: "hidden",
    });
}

function createHeader(): HTMLDivElement {
    const header = document.createElement("div");
    Object.assign(header.style, {
        padding: "8px 12px", backgroundColor: "#2d2d2d", borderBottom: "1px solid #3c3c3c",
        cursor: "move", userSelect: "none", display: "flex", alignItems: "center", gap: "8px",
    });
    const icon = document.createElement("span");
    icon.textContent = "\u{1F680}";
    const title = document.createElement("span");
    title.textContent = "Space Game";
    title.style.fontWeight = "500";
    header.append(icon, title);
    return header;
}

function setupDragHandlers(header: HTMLDivElement): void {
    header.addEventListener("mousedown", onDragStart);
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", onDragEnd);
}

function onDragStart(e: MouseEvent): void {
    if (!panelElement) return;
    isDragging = true;
    const rect = panelElement.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
}

function onDrag(e: MouseEvent): void {
    if (!isDragging || !panelElement) return;
    panelElement.style.left = `${e.clientX - dragOffset.x}px`;
    panelElement.style.top = `${e.clientY - dragOffset.y}px`;
    panelElement.style.right = "auto";
}

function onDragEnd(): void {
    isDragging = false;
}
