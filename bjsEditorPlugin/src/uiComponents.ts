/**
 * Reusable UI components for the floating panel
 */

export function createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    Object.assign(btn.style, {
        padding: "8px 12px",
        backgroundColor: "#0d6efd",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "13px",
        transition: "background-color 0.2s",
    });

    btn.addEventListener("mouseenter", () => (btn.style.backgroundColor = "#0b5ed7"));
    btn.addEventListener("mouseleave", () => (btn.style.backgroundColor = "#0d6efd"));
    btn.addEventListener("click", onClick);

    return btn;
}

export function createNumberInput(value: number, step: string, min: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(value);
    input.step = step;
    input.min = min;
    Object.assign(input.style, {
        flex: "1",
        minWidth: "0",
        padding: "6px",
        backgroundColor: "#2d2d2d",
        border: "1px solid #3c3c3c",
        borderRadius: "4px",
        color: "#e0e0e0",
        fontSize: "13px",
        boxSizing: "border-box",
    });
    return input;
}

export function createSeparator(): HTMLDivElement {
    const sep = document.createElement("div");
    sep.style.borderTop = "1px solid #3c3c3c";
    sep.style.margin = "4px 0";
    return sep;
}

export function createLabel(text: string): HTMLLabelElement {
    const label = document.createElement("label");
    label.textContent = text;
    label.style.fontSize = "12px";
    label.style.color = "#aaa";
    return label;
}

export function createRow(): HTMLDivElement {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", gap: "8px", alignItems: "center" });
    return row;
}
