import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './authService';
import log from '../core/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_PROJECT;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;

/**
 * Singleton service for managing Supabase client
 * Integrates with Auth0 JWT tokens for authenticated requests
 */
export class SupabaseService {
    private static _instance: SupabaseService;
    private _client: SupabaseClient | null = null;
    private _authenticatedClient: SupabaseClient | null = null;

    private constructor() {
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            this._client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            log.warn('[SupabaseService] Supabase not configured - cloud features disabled');
        }
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): SupabaseService {
        if (!SupabaseService._instance) {
            SupabaseService._instance = new SupabaseService();
        }
        return SupabaseService._instance;
    }

    /**
     * Check if Supabase is configured
     */
    public isConfigured(): boolean {
        return this._client !== null;
    }

    /**
     * Get the base Supabase client (for unauthenticated requests like reading leaderboard)
     */
    public getClient(): SupabaseClient | null {
        return this._client;
    }

    /**
     * Get an authenticated Supabase client using Auth0 JWT token
     * Creates a new client instance with the token in headers
     */
    public async getAuthenticatedClient(): Promise<SupabaseClient | null> {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            log.warn('[SupabaseService] Missing Supabase URL or key');
            return null;
        }

        const authService = AuthService.getInstance();
        const token = await authService.getAccessToken();

        if (!token) {
            log.warn('[SupabaseService] No auth token available');
            return null;
        }

        log.info('[SupabaseService] Got Auth0 token, length:', token.length);

        // Debug: decode JWT to see claims (without verification)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            log.info('[SupabaseService] Token claims:', {
                iss: payload.iss,
                sub: payload.sub,
                aud: payload.aud,
                exp: payload.exp,
                role: payload.role
            });
        } catch (_e) {
            log.warn('[SupabaseService] Could not decode token');
        }

        // Create a new client with the Auth0 token for RLS
        this._authenticatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        return this._authenticatedClient;
    }

    /**
     * Ensure user exists in internal users table, creating if needed
     * Maps Auth0 sub to internal UUID
     * Returns the internal user ID (UUID)
     */
    public async ensureUserExists(): Promise<string | null> {
        const client = await this.getAuthenticatedClient();
        if (!client) {
            return null;
        }

        const authService = AuthService.getInstance();
        const user = authService.getUser();
        if (!user?.sub) {
            log.warn('[SupabaseService] No user sub available');
            return null;
        }

        // Try to get existing user
        const { data: existingUser, error: fetchError } = await client
            .from('users')
            .select('id')
            .eq('auth0_id', user.sub)
            .single();

        if (existingUser) {
            return existingUser.id;
        }

        // User doesn't exist, create them
        if (fetchError && fetchError.code === 'PGRST116') {
            const { data: newUser, error: insertError } = await client
                .from('users')
                .insert({
                    auth0_id: user.sub,
                    display_name: user.name || user.nickname || 'Player'
                })
                .select('id')
                .single();

            if (insertError) {
                log.error('[SupabaseService] Failed to create user:', insertError);
                return null;
            }

            return newUser?.id || null;
        }

        if (fetchError) {
            log.error('[SupabaseService] Failed to fetch user:', fetchError);
        }

        return null;
    }
}
