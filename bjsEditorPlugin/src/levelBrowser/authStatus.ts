/**
 * Auth status display and login/logout buttons
 */
import { isAuthenticated, login, logout } from "../services/pluginAuth";
import { createButton } from "../uiComponents";

export function createAuthSection(onAuthChange: () => void): HTMLDivElement {
    const section = document.createElement("div");
    section.id = "auth-status-section";
    section.style.marginBottom = "8px";
    updateAuthSection(section, onAuthChange);
    return section;
}

export function updateAuthSection(section: HTMLElement, onAuthChange: () => void): void {
    section.innerHTML = "";

    if (isAuthenticated()) {
        const label = document.createElement("div");
        label.textContent = "Signed in";
        label.style.cssText = "font-size: 11px; color: #888; margin-bottom: 6px;";

        const btn = createButton("Sign Out", async () => {
            await logout();
            onAuthChange();
        });
        btn.style.width = "100%";
        btn.style.backgroundColor = "#6c757d";

        section.appendChild(label);
        section.appendChild(btn);
    } else {
        const btn = createButton("Sign In", async () => {
            try {
                await login();
                onAuthChange();
            } catch (err) {
                console.error("Login failed:", err);
            }
        });
        btn.style.width = "100%";
        section.appendChild(btn);
    }
}
