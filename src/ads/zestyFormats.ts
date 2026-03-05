const CDN_BASE = 'https://cdn.zesty.xyz/sdk/assets';

export interface FormatInfo {
    width: number;
    height: number;
    defaultImage: string;
}

export const formats: Record<string, FormatInfo> = {
    billboard: {
        width: 3.88,
        height: 1,
        defaultImage: `${CDN_BASE}/zesty-default-billboard.png`,
    },
    'medium-rectangle': {
        width: 1.2,
        height: 1,
        defaultImage: `${CDN_BASE}/zesty-default-medium-rectangle.png`,
    },
};
