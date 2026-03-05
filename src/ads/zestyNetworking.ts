import { formats } from './zestyFormats';

const API_BASE = 'https://api.zesty.market/api';
const GRAPHQL_URL = 'https://market.zesty.xyz/graphql';

export const AD_REFRESH_INTERVAL = 30000;

export interface AdData {
    assetUrl: string;
    ctaUrl: string;
    campaignId: string;
}

function detectPlatform(): { name: string; confidence: string } {
    const ua = navigator.userAgent;
    if (/OculusBrowser/i.test(ua)) return { name: 'Oculus', confidence: 'high' };
    if (/Wolvic/i.test(ua)) return { name: 'Wolvic', confidence: 'high' };
    if (/Pico/i.test(ua)) return { name: 'Pico', confidence: 'medium' };
    return { name: 'Desktop', confidence: 'low' };
}

export async function fetchCampaignAd(
    adUnitId: string, format: string
): Promise<AdData> {
    try {
        const url = encodeURI(window.location.href).replace(/\/$/, '');
        const res = await fetch(
            `${API_BASE}/ad?ad_unit_id=${adUnitId}&url=${url}`
        );
        if (res.status === 200) {
            const json = await res.json();
            if (json.Ads?.length) {
                return {
                    assetUrl: json.Ads[0].asset_url,
                    ctaUrl: json.Ads[0].cta_url,
                    campaignId: json.CampaignId ?? '',
                };
            }
        }
    } catch {
        console.warn('Zesty: failed to fetch ad, using default');
    }
    const fmt = formats[format] ?? formats['billboard'];
    return { assetUrl: fmt.defaultImage, ctaUrl: '', campaignId: '' };
}

async function sendMetric(
    eventType: string, adUnitId: string, campaignId: string
): Promise<void> {
    const { name, confidence } = detectPlatform();
    const query = `mutation { increment(
        eventType: ${eventType},
        spaceId: "${adUnitId}",
        campaignId: "${campaignId}",
        platform: { name: ${name}, confidence: ${confidence} }
    ) { message } }`;
    try {
        await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
    } catch {
        console.warn(`Zesty: failed to send ${eventType} metric`);
    }
}

export async function sendOnLoadMetric(
    adUnitId: string, campaignId: string
): Promise<void> {
    await sendMetric('visits', adUnitId, campaignId);
}

export async function sendOnClickMetric(
    adUnitId: string, campaignId: string
): Promise<void> {
    await sendMetric('clicks', adUnitId, campaignId);
}
