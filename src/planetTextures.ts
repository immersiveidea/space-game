/**
 * Planet texture paths for randomly generating planets
 * All textures are 512x512 PNG files
 */

export const PLANET_TEXTURES = [
    // Arid planets (5 textures)
    "/planetTextures/Arid/Arid_01-512x512.png",
    "/planetTextures/Arid/Arid_02-512x512.png",
    "/planetTextures/Arid/Arid_03-512x512.png",
    "/planetTextures/Arid/Arid_04-512x512.png",
    "/planetTextures/Arid/Arid_05-512x512.png",

    // Barren planets (5 textures)
    "/planetTextures/Barren/Barren_01-512x512.png",
    "/planetTextures/Barren/Barren_02-512x512.png",
    "/planetTextures/Barren/Barren_03-512x512.png",
    "/planetTextures/Barren/Barren_04-512x512.png",
    "/planetTextures/Barren/Barren_05-512x512.png",

    // Dusty planets (5 textures)
    "/planetTextures/Dusty/Dusty_01-512x512.png",
    "/planetTextures/Dusty/Dusty_02-512x512.png",
    "/planetTextures/Dusty/Dusty_03-512x512.png",
    "/planetTextures/Dusty/Dusty_04-512x512.png",
    "/planetTextures/Dusty/Dusty_05-512x512.png",

    // Gaseous planets (20 textures)
    "/planetTextures/Gaseous/Gaseous_01-512x512.png",
    "/planetTextures/Gaseous/Gaseous_02-512x512.png",
    "/planetTextures/Gaseous/Gaseous_03-512x512.png",
    "/planetTextures/Gaseous/Gaseous_04-512x512.png",
    "/planetTextures/Gaseous/Gaseous_05-512x512.png",
    "/planetTextures/Gaseous/Gaseous_06-512x512.png",
    "/planetTextures/Gaseous/Gaseous_07-512x512.png",
    "/planetTextures/Gaseous/Gaseous_08-512x512.png",
    "/planetTextures/Gaseous/Gaseous_09-512x512.png",
    "/planetTextures/Gaseous/Gaseous_10-512x512.png",
    "/planetTextures/Gaseous/Gaseous_11-512x512.png",
    "/planetTextures/Gaseous/Gaseous_12-512x512.png",
    "/planetTextures/Gaseous/Gaseous_13-512x512.png",
    "/planetTextures/Gaseous/Gaseous_14-512x512.png",
    "/planetTextures/Gaseous/Gaseous_15-512x512.png",
    "/planetTextures/Gaseous/Gaseous_16-512x512.png",
    "/planetTextures/Gaseous/Gaseous_17-512x512.png",
    "/planetTextures/Gaseous/Gaseous_18-512x512.png",
    "/planetTextures/Gaseous/Gaseous_19-512x512.png",
    "/planetTextures/Gaseous/Gaseous_20-512x512.png",

    // Grassland planets (5 textures)
    "/planetTextures/Grassland/Grassland_01-512x512.png",
    "/planetTextures/Grassland/Grassland_02-512x512.png",
    "/planetTextures/Grassland/Grassland_03-512x512.png",
    "/planetTextures/Grassland/Grassland_04-512x512.png",
    "/planetTextures/Grassland/Grassland_05-512x512.png",

    // Jungle planets (5 textures)
    "/planetTextures/Jungle/Jungle_01-512x512.png",
    "/planetTextures/Jungle/Jungle_02-512x512.png",
    "/planetTextures/Jungle/Jungle_03-512x512.png",
    "/planetTextures/Jungle/Jungle_04-512x512.png",
    "/planetTextures/Jungle/Jungle_05-512x512.png",

    // Marshy planets (5 textures)
    "/planetTextures/Marshy/Marshy_01-512x512.png",
    "/planetTextures/Marshy/Marshy_02-512x512.png",
    "/planetTextures/Marshy/Marshy_03-512x512.png",
    "/planetTextures/Marshy/Marshy_04-512x512.png",
    "/planetTextures/Marshy/Marshy_05-512x512.png",

    // Martian planets (5 textures)
    "/planetTextures/Martian/Martian_01-512x512.png",
    "/planetTextures/Martian/Martian_02-512x512.png",
    "/planetTextures/Martian/Martian_03-512x512.png",
    "/planetTextures/Martian/Martian_04-512x512.png",
    "/planetTextures/Martian/Martian_05-512x512.png",

    // Methane planets (5 textures)
    "/planetTextures/Methane/Methane_01-512x512.png",
    "/planetTextures/Methane/Methane_02-512x512.png",
    "/planetTextures/Methane/Methane_03-512x512.png",
    "/planetTextures/Methane/Methane_04-512x512.png",
    "/planetTextures/Methane/Methane_05-512x512.png",

    // Sandy planets (5 textures)
    "/planetTextures/Sandy/Sandy_01-512x512.png",
    "/planetTextures/Sandy/Sandy_02-512x512.png",
    "/planetTextures/Sandy/Sandy_03-512x512.png",
    "/planetTextures/Sandy/Sandy_04-512x512.png",
    "/planetTextures/Sandy/Sandy_05-512x512.png",

    // Snowy planets (5 textures)
    "/planetTextures/Snowy/Snowy_01-512x512.png",
    "/planetTextures/Snowy/Snowy_02-512x512.png",
    "/planetTextures/Snowy/Snowy_03-512x512.png",
    "/planetTextures/Snowy/Snowy_04-512x512.png",
    "/planetTextures/Snowy/Snowy_05-512x512.png",

    // Tundra planets (5 textures)
    "/planetTextures/Tundra/Tundra_01-512x512.png",
    "/planetTextures/Tundra/Tundra_02-512x512.png",
    "/planetTextures/Tundra/Tundra_03-512x512.png",
    "/planetTextures/Tundra/Tundra_04-512x512.png",
    "/planetTextures/Tundra/Tundral-EQUIRECTANGULAR-5-512x512.png",
];

/**
 * Get a random planet texture path
 */
export function getRandomPlanetTexture(): string {
    return PLANET_TEXTURES[Math.floor(Math.random() * PLANET_TEXTURES.length)];
}

/**
 * Planet texture categories organized by type
 */
export const PLANET_TEXTURES_BY_TYPE = {
    arid: [
        "/planetTextures/Arid/Arid_01-512x512.png",
        "/planetTextures/Arid/Arid_02-512x512.png",
        "/planetTextures/Arid/Arid_03-512x512.png",
        "/planetTextures/Arid/Arid_04-512x512.png",
        "/planetTextures/Arid/Arid_05-512x512.png",
    ],
    barren: [
        "/planetTextures/Barren/Barren_01-512x512.png",
        "/planetTextures/Barren/Barren_02-512x512.png",
        "/planetTextures/Barren/Barren_03-512x512.png",
        "/planetTextures/Barren/Barren_04-512x512.png",
        "/planetTextures/Barren/Barren_05-512x512.png",
    ],
    dusty: [
        "/planetTextures/Dusty/Dusty_01-512x512.png",
        "/planetTextures/Dusty/Dusty_02-512x512.png",
        "/planetTextures/Dusty/Dusty_03-512x512.png",
        "/planetTextures/Dusty/Dusty_04-512x512.png",
        "/planetTextures/Dusty/Dusty_05-512x512.png",
    ],
    gaseous: [
        "/planetTextures/Gaseous/Gaseous_01-512x512.png",
        "/planetTextures/Gaseous/Gaseous_02-512x512.png",
        "/planetTextures/Gaseous/Gaseous_03-512x512.png",
        "/planetTextures/Gaseous/Gaseous_04-512x512.png",
        "/planetTextures/Gaseous/Gaseous_05-512x512.png",
        "/planetTextures/Gaseous/Gaseous_06-512x512.png",
        "/planetTextures/Gaseous/Gaseous_07-512x512.png",
        "/planetTextures/Gaseous/Gaseous_08-512x512.png",
        "/planetTextures/Gaseous/Gaseous_09-512x512.png",
        "/planetTextures/Gaseous/Gaseous_10-512x512.png",
        "/planetTextures/Gaseous/Gaseous_11-512x512.png",
        "/planetTextures/Gaseous/Gaseous_12-512x512.png",
        "/planetTextures/Gaseous/Gaseous_13-512x512.png",
        "/planetTextures/Gaseous/Gaseous_14-512x512.png",
        "/planetTextures/Gaseous/Gaseous_15-512x512.png",
        "/planetTextures/Gaseous/Gaseous_16-512x512.png",
        "/planetTextures/Gaseous/Gaseous_17-512x512.png",
        "/planetTextures/Gaseous/Gaseous_18-512x512.png",
        "/planetTextures/Gaseous/Gaseous_19-512x512.png",
        "/planetTextures/Gaseous/Gaseous_20-512x512.png",
    ],
    grassland: [
        "/planetTextures/Grassland/Grassland_01-512x512.png",
        "/planetTextures/Grassland/Grassland_02-512x512.png",
        "/planetTextures/Grassland/Grassland_03-512x512.png",
        "/planetTextures/Grassland/Grassland_04-512x512.png",
        "/planetTextures/Grassland/Grassland_05-512x512.png",
    ],
    jungle: [
        "/planetTextures/Jungle/Jungle_01-512x512.png",
        "/planetTextures/Jungle/Jungle_02-512x512.png",
        "/planetTextures/Jungle/Jungle_03-512x512.png",
        "/planetTextures/Jungle/Jungle_04-512x512.png",
        "/planetTextures/Jungle/Jungle_05-512x512.png",
    ],
    marshy: [
        "/planetTextures/Marshy/Marshy_01-512x512.png",
        "/planetTextures/Marshy/Marshy_02-512x512.png",
        "/planetTextures/Marshy/Marshy_03-512x512.png",
        "/planetTextures/Marshy/Marshy_04-512x512.png",
        "/planetTextures/Marshy/Marshy_05-512x512.png",
    ],
    martian: [
        "/planetTextures/Martian/Martian_01-512x512.png",
        "/planetTextures/Martian/Martian_02-512x512.png",
        "/planetTextures/Martian/Martian_03-512x512.png",
        "/planetTextures/Martian/Martian_04-512x512.png",
        "/planetTextures/Martian/Martian_05-512x512.png",
    ],
    methane: [
        "/planetTextures/Methane/Methane_01-512x512.png",
        "/planetTextures/Methane/Methane_02-512x512.png",
        "/planetTextures/Methane/Methane_03-512x512.png",
        "/planetTextures/Methane/Methane_04-512x512.png",
        "/planetTextures/Methane/Methane_05-512x512.png",
    ],
    sandy: [
        "/planetTextures/Sandy/Sandy_01-512x512.png",
        "/planetTextures/Sandy/Sandy_02-512x512.png",
        "/planetTextures/Sandy/Sandy_03-512x512.png",
        "/planetTextures/Sandy/Sandy_04-512x512.png",
        "/planetTextures/Sandy/Sandy_05-512x512.png",
    ],
    snowy: [
        "/planetTextures/Snowy/Snowy_01-512x512.png",
        "/planetTextures/Snowy/Snowy_02-512x512.png",
        "/planetTextures/Snowy/Snowy_03-512x512.png",
        "/planetTextures/Snowy/Snowy_04-512x512.png",
        "/planetTextures/Snowy/Snowy_05-512x512.png",
    ],
    tundra: [
        "/planetTextures/Tundra/Tundra_01-512x512.png",
        "/planetTextures/Tundra/Tundra_02-512x512.png",
        "/planetTextures/Tundra/Tundra_03-512x512.png",
        "/planetTextures/Tundra/Tundra_04-512x512.png",
        "/planetTextures/Tundra/Tundral-EQUIRECTANGULAR-5-512x512.png",
    ],
};

/**
 * Get a random texture from a specific planet type
 */
export function getRandomTextureByType(type: keyof typeof PLANET_TEXTURES_BY_TYPE): string {
    const textures = PLANET_TEXTURES_BY_TYPE[type];
    return textures[Math.floor(Math.random() * textures.length)];
}
