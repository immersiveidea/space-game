/**
 * Manual token-based auth for Electron plugin
 * User generates token on website and pastes it here
 */
import { PLUGIN_CONFIG } from "../config";
import { showTokenEntryModal, closeTokenEntryModal } from "../levelBrowser/tokenEntryModal";

const STORAGE_KEY = "plugin_auth_token";

interface StoredAuth {
    accessToken: string;
    savedAt: number;
}

let currentAuth: StoredAuth | null = null;

export async function initAuth(): Promise<void> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            currentAuth = JSON.parse(stored) as StoredAuth;
        } catch { /* ignore invalid stored data */ }
    }
}

export async function login(): Promise<void> {
    return new Promise((resolve, reject) => {
        showTokenEntryModal(
            `${PLUGIN_CONFIG.WEBSITE_URL}/profile`,
            (token: string) => {
                if (token.trim()) {
                    storeAuth(token.trim());
                    closeTokenEntryModal();
                    resolve();
                } else {
                    reject(new Error("No token provided"));
                }
            },
            () => {
                closeTokenEntryModal();
                reject(new Error("Login cancelled"));
            }
        );
    });
}

export async function logout(): Promise<void> {
    currentAuth = null;
    localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated(): boolean {
    return currentAuth !== null && !!currentAuth.accessToken;
}

export function getAccessToken(): string | undefined {
    if (!currentAuth) return undefined;
    return currentAuth.accessToken;
}

function storeAuth(token: string): void {
    currentAuth = {
        accessToken: token,
        savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAuth));
}
