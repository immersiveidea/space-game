/**
 * Utility functions for notifications, clipboard, and file downloads
 */

export function showNotification(message: string, isError = false): void {
    const el = document.createElement("div");
    Object.assign(el.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        padding: "12px 20px",
        backgroundColor: isError ? "#dc3545" : "#198754",
        color: "white",
        borderRadius: "6px",
        zIndex: "10001",
        fontSize: "13px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    });
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

export async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
    }
}

export function downloadJson(content: string, filename: string): void {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
