import Beacon from '@zestyxyz/beacon';
import log from '../core/logger';

/**
 * Initialize the Zesty beacon for spatial web discovery.
 * Only runs in production (non-dev) environments.
 */
export async function initBeacon(): Promise<void> {
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname.includes('dev.') ||
                  window.location.port !== '';
    if (isDev) return;

    try {
        const beacon = new Beacon('https://relay.zesty.xyz');
        await beacon.signal();
        log.info('[Beacon] Registered with relay');
    } catch (error) {
        log.error('[Beacon] Failed to signal:', error);
    }
}
