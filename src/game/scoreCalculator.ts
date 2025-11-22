/**
 * Score calculation system for space shooter game
 * Uses linear-clamped multipliers that never go negative
 * Rewards speed, accuracy, fuel efficiency, and hull integrity
 */

/**
 * Star rating levels (0-3 stars per category)
 */
export interface StarRatings {
    time: number;        // 0-3 stars based on completion time
    accuracy: number;    // 0-3 stars based on shot accuracy
    fuel: number;        // 0-3 stars based on fuel efficiency
    hull: number;        // 0-3 stars based on hull integrity
    total: number;       // Sum of all star ratings (0-12)
}

/**
 * Debug information for score calculation
 */
export interface ScoreDebugInfo {
    rawFuelConsumed: number;    // Actual fuel consumed (can be >100%)
    rawHullDamage: number;      // Actual hull damage (can be >100%)
    fuelEfficiency: number;     // 0-100 display value (clamped)
    hullIntegrity: number;      // 0-100 display value (clamped)
}

/**
 * Complete score calculation result
 */
export interface ScoreCalculation {
    baseScore: number;
    timeMultiplier: number;
    accuracyMultiplier: number;
    fuelMultiplier: number;
    hullMultiplier: number;
    finalScore: number;
    stars: StarRatings;
    debug: ScoreDebugInfo;
}

/**
 * Configuration for score calculation
 */
export interface ScoreConfig {
    baseScore?: number;     // Default: 10000
    minMultiplier?: number; // Minimum multiplier floor (default: 0.5)
    maxTimeMultiplier?: number; // Maximum time bonus (default: 3.0)
    minTimeMultiplier?: number; // Minimum time multiplier (default: 0.1)
}

/**
 * Calculate final score based on performance metrics
 *
 * @param gameTimeSeconds - Total game time in seconds
 * @param accuracy - Shot accuracy percentage (0-100)
 * @param fuelConsumed - Fuel consumed percentage (0-∞, can exceed 100% with refuels)
 * @param hullDamage - Hull damage percentage (0-∞, can exceed 100% with deaths/repairs)
 * @param parTime - Expected completion time in seconds (default: 120)
 * @param config - Optional scoring configuration
 * @returns Complete score calculation with multipliers and star ratings
 */
export function calculateScore(
    gameTimeSeconds: number,
    accuracy: number,
    fuelConsumed: number,
    hullDamage: number,
    parTime: number = 120,
    config: ScoreConfig = {}
): ScoreCalculation {
    const {
        baseScore = 10000,
        minMultiplier = 0.5,
        maxTimeMultiplier = 3.0,
        minTimeMultiplier = 0.1
    } = config;

    // ============================================
    // TIME MULTIPLIER
    // ============================================
    // Exponential decay from par time
    // Faster than par = >1.0x, slower = <1.0x
    // Clamped between minTimeMultiplier and maxTimeMultiplier
    const timeRatio = gameTimeSeconds / parTime;
    const timeMultiplier = Math.max(
        minTimeMultiplier,
        Math.min(
            maxTimeMultiplier,
            Math.exp(-timeRatio + 1) * 2
        )
    );

    // ============================================
    // ACCURACY MULTIPLIER
    // ============================================
    // Linear scaling: 0% = 1.0x, 100% = 2.0x
    // Accuracy is always 0-100%, so no clamping needed
    const accuracyMultiplier = 1.0 + (accuracy / 100);

    // ============================================
    // FUEL EFFICIENCY MULTIPLIER
    // ============================================
    // Linear with floor for refueling scenarios
    // 0% consumed = 2.0x (perfect)
    // 50% consumed = 1.5x
    // 100% consumed = 1.0x
    // >100% consumed = minMultiplier floor (e.g., 0.5x)
    const fuelEfficiencyScore = Math.max(0, 100 - fuelConsumed);
    const fuelMultiplier = Math.max(
        minMultiplier,
        1.0 + (fuelEfficiencyScore / 100)
    );

    // ============================================
    // HULL INTEGRITY MULTIPLIER
    // ============================================
    // Linear with floor for death/repair scenarios
    // 0% damage = 2.0x (perfect)
    // 50% damage = 1.5x
    // 100% damage = 1.0x
    // >100% damage = minMultiplier floor (e.g., 0.5x)
    const hullIntegrityScore = Math.max(0, 100 - hullDamage);
    const hullMultiplier = Math.max(
        minMultiplier,
        1.0 + (hullIntegrityScore / 100)
    );

    // ============================================
    // FINAL SCORE CALCULATION
    // ============================================
    const finalScore = Math.floor(
        baseScore *
        timeMultiplier *
        accuracyMultiplier *
        fuelMultiplier *
        hullMultiplier
    );

    // ============================================
    // STAR RATINGS
    // ============================================
    const stars: StarRatings = {
        time: getTimeStars(gameTimeSeconds, parTime),
        accuracy: getAccuracyStars(accuracy),
        fuel: getFuelStars(fuelConsumed),
        hull: getHullStars(hullDamage),
        total: 0
    };
    stars.total = stars.time + stars.accuracy + stars.fuel + stars.hull;

    // ============================================
    // DEBUG INFO
    // ============================================
    const debug: ScoreDebugInfo = {
        rawFuelConsumed: fuelConsumed,
        rawHullDamage: hullDamage,
        fuelEfficiency: Math.max(0, Math.min(100, 100 - fuelConsumed)),
        hullIntegrity: Math.max(0, Math.min(100, 100 - hullDamage))
    };

    return {
        baseScore,
        timeMultiplier,
        accuracyMultiplier,
        fuelMultiplier,
        hullMultiplier,
        finalScore,
        stars,
        debug
    };
}

/**
 * Calculate time stars based on completion time vs par
 *
 * @param seconds - Completion time in seconds
 * @param par - Par time in seconds
 * @returns 0-3 stars
 */
export function getTimeStars(seconds: number, par: number): number {
    const ratio = seconds / par;
    if (ratio <= 0.5) return 3;  // Finished in half the par time
    if (ratio <= 1.0) return 2;  // Finished at or under par
    if (ratio <= 1.5) return 1;  // Finished within 150% of par
    return 0;                     // Over 150% of par
}

/**
 * Calculate accuracy stars based on hit percentage
 *
 * @param accuracy - Shot accuracy percentage (0-100)
 * @returns 0-3 stars
 */
export function getAccuracyStars(accuracy: number): number {
    if (accuracy >= 75) return 3;  // Excellent accuracy
    if (accuracy >= 50) return 2;  // Good accuracy
    if (accuracy >= 25) return 1;  // Fair accuracy
    return 0;                       // Poor accuracy
}

/**
 * Calculate fuel efficiency stars
 *
 * @param fuelConsumed - Fuel consumed percentage (0-∞)
 * @returns 0-3 stars
 */
export function getFuelStars(fuelConsumed: number): number {
    // Stars only consider first 100% of fuel
    // Refueling doesn't earn extra stars
    if (fuelConsumed <= 30) return 3;  // Used ≤30% fuel
    if (fuelConsumed <= 60) return 2;  // Used ≤60% fuel
    if (fuelConsumed <= 80) return 1;  // Used ≤80% fuel
    return 0;                           // Used >80% fuel (including refuels)
}

/**
 * Calculate hull integrity stars
 *
 * @param hullDamage - Hull damage percentage (0-∞)
 * @returns 0-3 stars
 */
export function getHullStars(hullDamage: number): number {
    // Stars only consider first 100% of damage
    // Dying and respawning = 0 stars
    if (hullDamage <= 10) return 3;  // Took ≤10% damage
    if (hullDamage <= 30) return 2;  // Took ≤30% damage
    if (hullDamage <= 60) return 1;  // Took ≤60% damage
    return 0;                         // Took >60% damage (including deaths)
}

/**
 * Get star rating color based on count
 *
 * @param stars - Number of stars (0-3)
 * @returns Hex color code
 */
export function getStarColor(stars: number): string {
    switch (stars) {
        case 3: return '#FFD700'; // Gold
        case 2: return '#C0C0C0'; // Silver
        case 1: return '#CD7F32'; // Bronze
        default: return '#808080'; // Gray
    }
}

/**
 * Format stars as Unicode string
 *
 * @param earned - Number of stars earned (0-3)
 * @param total - Total possible stars (default: 3)
 * @returns Unicode star string (e.g., "★★☆")
 */
export function formatStars(earned: number, total: number = 3): string {
    const filled = '★'.repeat(Math.min(earned, total));
    const empty = '☆'.repeat(Math.max(0, total - earned));
    return filled + empty;
}
