/**
 * Panel section creators for the floating UI
 */
import { createButton, createNumberInput, createSeparator, createLabel, createRow } from "./uiComponents";
import { FloatingUICallbacks } from "./floatingUI";
import { createAuthSection } from "./levelBrowser/authStatus";

export async function createContent(callbacks: FloatingUICallbacks): Promise<HTMLDivElement> {
    const content = document.createElement("div");
    Object.assign(content.style, { padding: "12px", display: "flex", flexDirection: "column", gap: "8px" });

    content.appendChild(createButton("Export Level", callbacks.onExport));
    content.appendChild(createButton("Copy to Clipboard", callbacks.onExportClipboard));
    content.appendChild(createSeparator());
    content.appendChild(createScaleSection(callbacks.onApplyUniformScale));
    content.appendChild(createSeparator());
    content.appendChild(createCameraSpeedSection(callbacks));
    content.appendChild(createSeparator());
    content.appendChild(await createCloudLevelsSection(callbacks));

    return content;
}

async function createCloudLevelsSection(callbacks: FloatingUICallbacks): Promise<HTMLDivElement> {
    const section = document.createElement("div");
    Object.assign(section.style, { display: "flex", flexDirection: "column", gap: "6px" });

    section.appendChild(createLabel("Cloud Levels"));
    section.appendChild(await createAuthSection(callbacks.onAuthChange));

    const row = createRow();
    const officialBtn = createButton("Official", callbacks.onBrowseOfficial);
    const myBtn = createButton("My Levels", callbacks.onBrowseMyLevels);
    officialBtn.style.flex = "1";
    myBtn.style.flex = "1";
    row.appendChild(officialBtn);
    row.appendChild(myBtn);
    section.appendChild(row);

    return section;
}

function createScaleSection(onApply: (scale: number) => void): HTMLDivElement {
    const row = createRow();
    row.style.width = "100%";

    const input = createNumberInput(1, "0.1", "0.1");
    const btn = createButton("Scale", () => onApply(parseFloat(input.value) || 1));
    btn.style.padding = "6px 12px";
    btn.style.flexShrink = "0";

    row.appendChild(input);
    row.appendChild(btn);
    return row;
}

function createCameraSpeedSection(callbacks: FloatingUICallbacks): HTMLDivElement {
    const section = document.createElement("div");
    Object.assign(section.style, { display: "flex", flexDirection: "column", gap: "6px" });

    const row = createRow();
    const input = createNumberInput(callbacks.getCameraSpeed(), "0.5", "0.5");
    const btn = createButton("Set", () => callbacks.onCameraSpeedChange(parseFloat(input.value) || 1));
    btn.style.padding = "6px 12px";
    btn.style.flexShrink = "0";

    row.appendChild(input);
    row.appendChild(btn);
    section.appendChild(createLabel("Camera Speed"));
    section.appendChild(row);
    return section;
}
