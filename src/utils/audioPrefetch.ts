import log from '../core/logger';

const AUDIO_BASE = '/assets/themes/default/audio';

// All audio files to prefetch
const AUDIO_FILES = [
    `${AUDIO_BASE}/explosion.mp3`,
    `${AUDIO_BASE}/thrust5.mp3`,
    `${AUDIO_BASE}/shot.mp3`,
    `${AUDIO_BASE}/collision.mp3`,
    `${AUDIO_BASE}/song1.mp3`,
    `${AUDIO_BASE}/song2.mp3`,
];

// Cache for prefetched audio buffers
const prefetchedAudio: Map<string, ArrayBuffer> = new Map();

/**
 * Prefetch all game audio files as ArrayBuffers
 */
export async function prefetchAllAudio(): Promise<void> {
    log.debug('[audioPrefetch] Prefetching all audio files...');

    const fetches = AUDIO_FILES.map(async (url) => {
        if (prefetchedAudio.has(url)) return;
        try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            prefetchedAudio.set(url, buffer);
            log.debug(`[audioPrefetch] ✓ Prefetched ${url}`);
        } catch (error) {
            log.error(`[audioPrefetch] Failed to prefetch ${url}:`, error);
        }
    });

    await Promise.all(fetches);
    log.debug(`[audioPrefetch] Prefetched ${prefetchedAudio.size}/${AUDIO_FILES.length} audio files`);
}

/**
 * Get prefetched audio buffer (returns clone to avoid detached buffer issues)
 */
export function getPrefetchedAudio(url: string): ArrayBuffer | null {
    const buffer = prefetchedAudio.get(url);
    return buffer ? buffer.slice(0) : null;
}

/**
 * Get audio source - returns prefetched buffer or falls back to URL
 */
export function getAudioSource(url: string): ArrayBuffer | string {
    return getPrefetchedAudio(url) || url;
}
