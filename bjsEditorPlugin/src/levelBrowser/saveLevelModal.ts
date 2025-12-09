/**
 * Modal for saving a level with name and difficulty
 */
const MODAL_ID = "save-level-modal";

interface SaveLevelData {
    name: string;
    difficulty: string;
}

export function showSaveLevelModal(
    onSave: (data: SaveLevelData) => void,
    onCancel: () => void
): void {
    closeSaveLevelModal();
    const overlay = createOverlay(onCancel);
    const modal = createModalContainer();
    modal.appendChild(createHeader(onCancel));
    modal.appendChild(createForm(onSave, onCancel));
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

export function closeSaveLevelModal(): void {
    document.getElementById(MODAL_ID)?.remove();
}

function createOverlay(onCancel: () => void): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10004";
    overlay.addEventListener("click", (e) => { if (e.target === overlay) onCancel(); });
    return overlay;
}

function createModalContainer(): HTMLDivElement {
    const modal = document.createElement("div");
    modal.style.cssText =
        "background:#1e1e1e;border-radius:8px;width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.5)";
    return modal;
}

function createHeader(onCancel: () => void): HTMLDivElement {
    const header = document.createElement("div");
    header.style.cssText = "padding:16px;border-bottom:1px solid #3c3c3c;display:flex;justify-content:space-between";
    const title = document.createElement("span");
    title.textContent = "Save Level";
    title.style.cssText = "font-weight:600;font-size:16px;color:#e0e0e0";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    closeBtn.style.cssText = "background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:0";
    closeBtn.addEventListener("click", onCancel);
    header.append(title, closeBtn);
    return header;
}

function createForm(onSave: (data: SaveLevelData) => void, onCancel: () => void): HTMLDivElement {
    const form = document.createElement("div");
    form.style.cssText = "padding:20px";

    // Name input
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Level Name";
    nameLabel.style.cssText = "display:block;color:#aaa;font-size:12px;margin-bottom:4px";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "My Awesome Level";
    nameInput.style.cssText = inputStyle();

    // Difficulty select
    const diffLabel = document.createElement("label");
    diffLabel.textContent = "Difficulty";
    diffLabel.style.cssText = "display:block;color:#aaa;font-size:12px;margin-bottom:4px;margin-top:12px";
    const diffSelect = document.createElement("select");
    diffSelect.style.cssText = inputStyle();
    ["recruit", "pilot", "captain", "commander"].forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d.charAt(0).toUpperCase() + d.slice(1);
        diffSelect.appendChild(opt);
    });

    // Buttons
    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;margin-top:20px;justify-content:flex-end";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;background:#6c757d;border:none;color:#fff;border-radius:4px;cursor:pointer";
    cancelBtn.addEventListener("click", onCancel);

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Level";
    saveBtn.style.cssText = "padding:8px 16px;background:#4fc3f7;border:none;color:#000;border-radius:4px;cursor:pointer;font-weight:500";
    saveBtn.addEventListener("click", () => {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        onSave({ name, difficulty: diffSelect.value });
    });

    buttons.append(cancelBtn, saveBtn);
    form.append(nameLabel, nameInput, diffLabel, diffSelect, buttons);
    return form;
}

function inputStyle(): string {
    return "width:100%;padding:8px;border:1px solid #3c3c3c;border-radius:4px;background:#2d2d2d;color:#e0e0e0;font-size:14px;box-sizing:border-box";
}
