/**
 * Lightweight Supabase client for plugin context
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PLUGIN_CONFIG } from "../config";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
    if (!client) {
        client = createClient(PLUGIN_CONFIG.SUPABASE_URL, PLUGIN_CONFIG.SUPABASE_ANON_KEY);
    }
    return client;
}
