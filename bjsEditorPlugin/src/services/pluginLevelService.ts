/**
 * Level service for fetching levels from Supabase
 */
import { getSupabaseClient } from "./pluginSupabase";
import { getAccessToken } from "./pluginAuth";
import type { LevelConfig } from "../types";

export interface CloudLevelEntry {
    id: string;
    name: string;
    description: string | null;
    difficulty: string;
    levelType: "official" | "private" | "pending_review" | "published" | "rejected";
    config: LevelConfig;
    updatedAt: string;
}

interface LevelRow {
    id: string;
    name: string;
    description: string | null;
    difficulty: string;
    level_type: string;
    config: LevelConfig | string;
    updated_at: string;
}

function rowToEntry(row: LevelRow): CloudLevelEntry {
    const config = typeof row.config === "string" ? JSON.parse(row.config) : row.config;
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        difficulty: row.difficulty,
        levelType: row.level_type as CloudLevelEntry["levelType"],
        config,
        updatedAt: row.updated_at,
    };
}

export async function getOfficialLevels(): Promise<CloudLevelEntry[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from("levels")
        .select("id, name, description, difficulty, level_type, config, updated_at")
        .eq("level_type", "official")
        .order("sort_order", { ascending: true });

    if (error || !data) return [];
    return data.map(rowToEntry);
}

export async function getPublishedLevels(): Promise<CloudLevelEntry[]> {
    const { data, error } = await getSupabaseClient()
        .from("levels")
        .select("id, name, description, difficulty, level_type, config, updated_at")
        .eq("level_type", "published")
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(rowToEntry);
}

export async function getMyLevels(): Promise<CloudLevelEntry[]> {
    const token = getAccessToken();
    if (!token) return [];

    const { data, error } = await getSupabaseClient()
        .rpc("get_my_levels_by_token", { p_token: token });

    if (error || !data) {
        console.error("Failed to fetch my levels:", error);
        return [];
    }
    return data.map(rowToEntry);
}

export async function saveLevel(
    name: string,
    difficulty: string,
    config: LevelConfig,
    levelId?: string
): Promise<string | null> {
    const token = getAccessToken();
    if (!token) return null;

    const { data, error } = await getSupabaseClient()
        .rpc("save_level_by_token", {
            p_token: token,
            p_name: name,
            p_difficulty: difficulty,
            p_config: config,
            p_level_id: levelId || null,
        });

    if (error) {
        console.error("Failed to save level:", error);
        return null;
    }
    return data;
}
