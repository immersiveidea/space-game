/**
 * Modal dialog for browsing and selecting levels
 */
import type { CloudLevelEntry } from "../services/pluginLevelService";

const MODAL_ID = "level-browser-modal";

interface ModalCallbacks {
    onSelectLevel: (level: CloudLevelEntry) => void;
    onClose: () => void;
    onSaveNew?: () => void;
    onSaveExisting?: (level: CloudLevelEntry) => void;
}

export function showLevelBrowserModal(levels: CloudLevelEntry[], title: string, callbacks: ModalCallbacks): void {
    closeLevelBrowserModal();
    const overlay = createOverlay(callbacks.onClose);
    const modal = createModalContainer();
    modal.appendChild(createHeader(title, callbacks.onClose));
    modal.appendChild(createLevelList(levels, callbacks));
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

export function closeLevelBrowserModal(): void {
    document.getElementById(MODAL_ID)?.remove();
}

function createOverlay(onClose: () => void): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10002";
    overlay.addEventListener("click", (e) => { if (e.target === overlay) onClose(); });
    return overlay;
}

function createModalContainer(): HTMLDivElement {
    const modal = document.createElement("div");
    modal.style.cssText =
        "background:#1e1e1e;border-radius:8px;width:500px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5)";
    return modal;
}

function createHeader(title: string, onClose: () => void): HTMLDivElement {
    const header = document.createElement("div");
    header.style.cssText = "padding:16px;border-bottom:1px solid #3c3c3c;display:flex;justify-content:space-between;align-items:center";
    const titleEl = document.createElement("span");
    titleEl.textContent = title;
    titleEl.style.cssText = "font-weight:600;font-size:16px;color:#e0e0e0";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    closeBtn.style.cssText = "background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:4px 8px";
    closeBtn.addEventListener("click", onClose);
    header.append(titleEl, closeBtn);
    return header;
}

function createLevelList(levels: CloudLevelEntry[], callbacks: ModalCallbacks): HTMLDivElement {
    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;flex:1;max-height:450px";

    const list = document.createElement("div");
    list.style.cssText = "overflow-y:auto;flex:1";

    if (levels.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding:32px;text-align:center;color:#888";
        empty.textContent = "No levels found";
        list.appendChild(empty);
    } else {
        for (const level of levels) {
            list.appendChild(createLevelItem(level, callbacks));
        }
    }

    container.appendChild(list);

    if (callbacks.onSaveNew) {
        container.appendChild(createFooter(callbacks.onSaveNew));
    }

    return container;
}

function createFooter(onSaveNew: () => void): HTMLDivElement {
    const footer = document.createElement("div");
    footer.style.cssText = "padding:12px 16px;border-top:1px solid #3c3c3c;display:flex;justify-content:center";
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "+ Save Current Scene as New Level";
    saveBtn.style.cssText = "padding:8px 16px;background:#4fc3f7;border:none;color:#000;border-radius:4px;cursor:pointer;font-weight:500";
    saveBtn.addEventListener("click", onSaveNew);
    footer.appendChild(saveBtn);
    return footer;
}

function createLevelItem(level: CloudLevelEntry, callbacks: ModalCallbacks): HTMLDivElement {
    const item = document.createElement("div");
    item.style.cssText = "padding:12px 16px;border-bottom:1px solid #2d2d2d;display:flex;justify-content:space-between;align-items:center";

    const info = document.createElement("div");
    info.style.cssText = "cursor:pointer;flex:1";
    info.innerHTML = `<div style="font-weight:500;color:#e0e0e0">${level.name}</div>
        <div style="font-size:11px;color:#888;margin-top:4px">${level.difficulty} | ${level.levelType} | ${new Date(level.updatedAt).toLocaleDateString()}</div>`;
    info.addEventListener("click", () => callbacks.onSelectLevel(level));

    item.appendChild(info);

    if (callbacks.onSaveExisting && level.levelType !== "official") {
        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save";
        saveBtn.style.cssText = "padding:4px 12px;background:#28a745;border:none;color:#fff;border-radius:4px;cursor:pointer;font-size:12px;margin-left:8px";
        saveBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onSaveExisting!(level);
        });
        item.appendChild(saveBtn);
    }

    item.addEventListener("mouseenter", () => (item.style.backgroundColor = "#2d2d2d"));
    item.addEventListener("mouseleave", () => (item.style.backgroundColor = "transparent"));
    return item;
}
