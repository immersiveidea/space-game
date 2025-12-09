/**
 * Modal for entering API token
 * User gets token from website profile page
 */
const MODAL_ID = "token-entry-modal";

export function showTokenEntryModal(
    profileUrl: string,
    onSubmit: (token: string) => void,
    onCancel: () => void
): void {
    closeTokenEntryModal();
    const overlay = createOverlay(onCancel);
    const modal = createModalContainer();
    modal.appendChild(createHeader(onCancel));
    modal.appendChild(createContent(profileUrl, onSubmit, onCancel));
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

export function closeTokenEntryModal(): void {
    document.getElementById(MODAL_ID)?.remove();
}

function createOverlay(onCancel: () => void): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10003";
    overlay.addEventListener("click", (e) => { if (e.target === overlay) onCancel(); });
    return overlay;
}

function createModalContainer(): HTMLDivElement {
    const modal = document.createElement("div");
    modal.style.cssText =
        "background:#1e1e1e;border-radius:8px;width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.5)";
    return modal;
}

function createHeader(onCancel: () => void): HTMLDivElement {
    const header = document.createElement("div");
    header.style.cssText = "padding:16px;border-bottom:1px solid #3c3c3c;display:flex;justify-content:space-between";
    const title = document.createElement("span");
    title.textContent = "Sign In with Token";
    title.style.cssText = "font-weight:600;font-size:16px;color:#e0e0e0";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    closeBtn.style.cssText = "background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:0";
    closeBtn.addEventListener("click", onCancel);
    header.append(title, closeBtn);
    return header;
}

function createContent(
    profileUrl: string,
    onSubmit: (token: string) => void,
    onCancel: () => void
): HTMLDivElement {
    const content = document.createElement("div");
    content.style.cssText = "padding:20px";

    const instructions = document.createElement("p");
    instructions.style.cssText = "color:#aaa;margin:0 0 16px;font-size:13px;line-height:1.5";
    instructions.innerHTML = `
        1. Visit your <a href="${profileUrl}" target="_blank" style="color:#81c784">profile page</a><br>
        2. Generate an Editor Token<br>
        3. Paste it below
    `;

    const input = document.createElement("textarea");
    input.placeholder = "Paste your token here...";
    input.style.cssText = `
        width:100%;height:80px;padding:10px;border:1px solid #3c3c3c;border-radius:4px;
        background:#2d2d2d;color:#e0e0e0;font-family:monospace;font-size:12px;resize:none;
        box-sizing:border-box;
    `;

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;margin-top:16px;justify-content:flex-end";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;background:#6c757d;border:none;color:#fff;border-radius:4px;cursor:pointer";
    cancelBtn.addEventListener("click", onCancel);

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Sign In";
    submitBtn.style.cssText = "padding:8px 16px;background:#4fc3f7;border:none;color:#000;border-radius:4px;cursor:pointer;font-weight:500";
    submitBtn.addEventListener("click", () => onSubmit(input.value));

    buttons.append(cancelBtn, submitBtn);
    content.append(instructions, input, buttons);
    return content;
}
