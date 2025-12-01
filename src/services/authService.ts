import { createAuth0Client, Auth0Client, User } from '@auth0/auth0-spa-js';
import log from '../core/logger';
import { SupabaseService } from './supabaseService';

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
        log.info('[AuthService] ========== INITIALIZE CALLED ==========');
        const domain = import.meta.env.VITE_AUTH0_DOMAIN;
        const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

        log.info('[AuthService] Config:', {
            domain,
            clientId: clientId ? clientId.substring(0, 10) + '...' : 'missing',
            redirectUri: window.location.origin
        });

        if (!domain || !clientId || domain.trim() === '') {
            log.warn('[AuthService] Auth0 not configured - authentication features will be disabled');
            return;
        }

        log.info('[AuthService] Creating Auth0 client...');
        const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
        this._client = await createAuth0Client({
            domain,
            clientId,
            authorizationParams: {
                redirect_uri: window.location.origin,
                audience: audience || undefined
            },
            cacheLocation: 'localstorage', // Persist tokens across page reloads
            useRefreshTokens: true // Enable silent token refresh
        });
        log.info('[AuthService] Auth0 client created successfully');

        // Handle redirect callback after login
        const hasCallback = window.location.search.includes('code=') ||
                           window.location.search.includes('state=');
        log.info('[AuthService] Checking for Auth0 callback:', hasCallback);
        log.info('[AuthService] Current URL:', window.location.href);

        if (hasCallback) {
            log.info('[AuthService] ========== PROCESSING AUTH0 CALLBACK ==========');
            try {
                const result = await this._client.handleRedirectCallback();
                log.info('[AuthService] Callback handled successfully:', result);
                // Clean up the URL after handling callback
                window.history.replaceState({}, document.title, '/');
                log.info('[AuthService] URL cleaned, redirected to home');
            } catch (error) {
                log.error('[AuthService] !!!!! CALLBACK ERROR !!!!!', error);
                log.error('[AuthService] Error details:', error?.message, error?.stack);
            }
        }

        // Check if user is authenticated and load user info
        log.info('[AuthService] Checking authentication status...');
        const isAuth = await this._client.isAuthenticated();
        log.info('[AuthService] Is authenticated:', isAuth);

        if (isAuth) {
            log.info('[AuthService] Loading user info...');
            this._user = await this._client.getUser() ?? null;
            log.info('[AuthService] User loaded:', {
                name: this._user?.name,
                email: this._user?.email,
                sub: this._user?.sub
            });

            // Sync user to Supabase (fire and forget - don't block init)
            this.syncUserToSupabase();
        } else {
            log.info('[AuthService] User not authenticated');
        }

        log.info('[AuthService] ========== INITIALIZATION COMPLETE ==========');
    }

    /**
     * Redirect to Auth0 login page
     */
    public async login(): Promise<void> {
        log.info('[AuthService] ========== LOGIN CALLED ==========');
        if (!this._client) {
            log.error('[AuthService] !!!!! CLIENT NOT INITIALIZED !!!!!');
            throw new Error('Auth client not initialized. Call initialize() first.');
        }
        log.info('[AuthService] Redirecting to Auth0 login...');
        await this._client.loginWithRedirect();
    }

    /**
     * Log out the current user and redirect to home
     */
    public async logout(): Promise<void> {
        log.info('[AuthService] ========== LOGOUT CALLED ==========');
        if (!this._client) {
            log.error('[AuthService] !!!!! CLIENT NOT INITIALIZED !!!!!');
            throw new Error('Auth client not initialized. Call initialize() first.');
        }
        this._user = null;
        log.info('[AuthService] Logging out and redirecting to:', window.location.origin);
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
            log.error('Error getting access token:', error);
            return undefined;
        }
    }

    /**
     * Sync user to Supabase users table
     * Called after successful authentication
     * Uses RPC to bypass RLS via security definer function
     */
    private async syncUserToSupabase(): Promise<void> {
        if (!this._user?.sub) return;

        const supabase = SupabaseService.getInstance();
        if (!supabase.isConfigured()) return;

        const client = await supabase.getAuthenticatedClient();
        if (!client) return;

        // Use security definer function to create/get user (bypasses RLS)
        const { data, error } = await client.rpc('get_or_create_user_id', {
            p_auth0_id: this._user.sub
        });

        if (error) {
            log.warn('[AuthService] Failed to sync user to Supabase:', error);
        } else {
            log.info('[AuthService] User synced to Supabase, UUID:', data);
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
