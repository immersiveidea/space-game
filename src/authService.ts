import { createAuth0Client, Auth0Client, User } from '@auth0/auth0-spa-js';

/**
 * Singleton service for managing Auth0 authentication
 * Handles login, logout, token management, and user state
 */
export class AuthService {
    private static _instance: AuthService;
    private _client: Auth0Client | null = null;
    private _user: User | null = null;

    private constructor() {}

    /**
     * Get the singleton instance of AuthService
     */
    public static getInstance(): AuthService {
        if (!AuthService._instance) {
            AuthService._instance = new AuthService();
        }
        return AuthService._instance;
    }

    /**
     * Initialize the Auth0 client and handle redirect callback
     * Call this early in the application lifecycle
     */
    public async initialize(): Promise<void> {
        const domain = import.meta.env.VITE_AUTH0_DOMAIN;
        const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

        if (!domain || !clientId || domain.trim() === '') {
            console.warn('Auth0 not configured - authentication features will be disabled');
            return;
        }
        console.log(window.location.origin);
        this._client = await createAuth0Client({
            domain,
            clientId,
            authorizationParams: {
                redirect_uri: window.location.origin
            },
            cacheLocation: 'localstorage', // Persist tokens across page reloads
            useRefreshTokens: true // Enable silent token refresh
        });

        // Handle redirect callback after login
        if (window.location.search.includes('code=') ||
            window.location.search.includes('state=')) {
            try {
                await this._client.handleRedirectCallback();
                // Clean up the URL after handling callback
                window.history.replaceState({}, document.title, '/');
            } catch (error) {
                console.error('Error handling redirect callback:', error);
            }
        }

        // Check if user is authenticated and load user info
        const isAuth = await this._client.isAuthenticated();
        if (isAuth) {
            this._user = await this._client.getUser() ?? null;
        }
    }

    /**
     * Redirect to Auth0 login page
     */
    public async login(): Promise<void> {
        if (!this._client) {
            throw new Error('Auth client not initialized. Call initialize() first.');
        }
        await this._client.loginWithRedirect();
    }

    /**
     * Log out the current user and redirect to home
     */
    public async logout(): Promise<void> {
        if (!this._client) {
            throw new Error('Auth client not initialized. Call initialize() first.');
        }
        this._user = null;
        await this._client.logout({
            logoutParams: {
                returnTo: window.location.origin
            }
        });
    }

    /**
     * Check if the user is currently authenticated
     */
    public async isAuthenticated(): Promise<boolean> {
        if (!this._client) return false;
        return await this._client.isAuthenticated();
    }

    /**
     * Get the current authenticated user's profile
     */
    public getUser(): User | null {
        return this._user;
    }

    /**
     * Get an access token for making authenticated API calls
     * Returns undefined if not authenticated
     */
    public async getAccessToken(): Promise<string | undefined> {
        if (!this._client) return undefined;
        try {
            return await this._client.getTokenSilently();
        } catch (error) {
            console.error('Error getting access token:', error);
            return undefined;
        }
    }

    /**
     * Check if user logged in via Facebook
     * Auth0 stores the identity provider in the user's sub claim
     */
    public isAuthenticatedWithFacebook(): boolean {
        if (!this._user) return false;

        // Check if user authenticated via Facebook
        // Auth0 sub format: "facebook|{facebook-user-id}" for Facebook logins
        const sub = this._user.sub || '';
        return sub.startsWith('facebook|');
    }

    /**
     * Get the authentication provider (facebook, google, auth0, etc.)
     */
    public getAuthProvider(): string | null {
        if (!this._user) return null;

        const sub = this._user.sub || '';
        const parts = sub.split('|');

        if (parts.length >= 2) {
            return parts[0]; // Returns 'facebook', 'google', 'auth0', etc.
        }

        return null;
    }

    /**
     * Get user's Facebook ID if authenticated via Facebook
     */
    public getFacebookUserId(): string | null {
        if (!this.isAuthenticatedWithFacebook()) return null;

        const sub = this._user?.sub || '';
        const parts = sub.split('|');

        if (parts.length >= 2) {
            return parts[1]; // Returns the Facebook user ID
        }

        return null;
    }
}
