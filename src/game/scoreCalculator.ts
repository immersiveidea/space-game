/**
 * Score calculation system for space shooter game
 * Additive scoring: starts at 0, builds through asteroid destruction and end-game bonuses
 */

// Bonus constants
const MAX_HULL_BONUS = 5000;
const MAX_FUEL_BONUS = 5000;
const MAX_ACCURACY_BONUS = 10000;

/**
 * Star rating levels (0-3 stars per category)
 */
interface StarRatings {
    asteroids: number;   // 0-3 stars based on asteroid destruction timing
    accuracy: number;    // 0-3 stars based on shot accuracy
    fuel: number;        // 0-3 stars based on fuel efficiency
    hull: number;        // 0-3 stars based on hull integrity
    total: number;       // Sum of all star ratings (0-12)
}

/**
 * End-game bonus breakdown
 */
export interface EndGameBonuses {
    hull: number;
    fuel: number;
    accuracy: number;
}

/**
 * Complete score calculation result
 */
export interface ScoreCalculation {
    asteroidScore: number;      // Points from destroying asteroids
    bonuses: EndGameBonuses;    // End-game bonuses
    finalScore: number;         // Total score
    stars: StarRatings;
}

/**
 * Calculate points for destroying an asteroid
 * @param scale - Asteroid scale (size)
 * @param elapsedSeconds - Time elapsed since game start
 * @param parTime - Expected level completion time
 * @returns Points earned for this asteroid
 */
export function calculateAsteroidPoints(
    scale: number,
    elapsedSeconds: number,
    parTime: number
): number {
    // Size points: smaller scale = more points
    // Small (<10): 1000 pts, Medium (10-20): 500 pts, Large (>20): 250 pts
    const sizePoints = scale < 10 ? 1000 : scale <= 20 ? 500 : 250;

    // Timing multiplier based on par time progress
    const progress = elapsedSeconds / parTime;
    const timingMultiplier = progress <= 0.333 ? 3 : progress <= 0.666 ? 2 : 1;

    return sizePoints * timingMultiplier;
}

/**
 * Calculate end-game bonuses based on performance
 * @param hullDamage - Total hull damage taken (0-300+%)
 * @param fuelConsumed - Total fuel consumed (0-300+%)
 * @param accuracy - Shot accuracy percentage (0-100%)
 * @returns Bonus points for each category
 */
export function calculateEndGameBonuses(
    hullDamage: number,
    fuelConsumed: number,
    accuracy: number
): EndGameBonuses {
    return {
        hull: Math.floor(MAX_HULL_BONUS * Math.max(0, 1 - hullDamage / 300)),
        fuel: Math.floor(MAX_FUEL_BONUS * Math.max(0, 1 - fuelConsumed / 300)),
        accuracy: Math.floor(MAX_ACCURACY_BONUS * Math.max(0, (accuracy - 1) / 99))
    };
}

/**
 * Calculate final score with all bonuses
 * @param asteroidScore - Running score from asteroid destruction
 * @param hullDamage - Hull damage percentage (0-300+%)
 * @param fuelConsumed - Fuel consumed percentage (0-300+%)
 * @param accuracy - Shot accuracy percentage (0-100%)
 * @param includeEndGameBonuses - Whether to include end-game bonuses (only at game end)
 * @returns Complete score calculation
 */
export function calculateFinalScore(
    asteroidScore: number,
    hullDamage: number,
    fuelConsumed: number,
    accuracy: number,
    includeEndGameBonuses: boolean = true
): ScoreCalculation {
    const bonuses = includeEndGameBonuses
        ? calculateEndGameBonuses(hullDamage, fuelConsumed, accuracy)
        : { hull: 0, fuel: 0, accuracy: 0 };
    const finalScore = asteroidScore + bonuses.hull + bonuses.fuel + bonuses.accuracy;

    const stars: StarRatings = {
        asteroids: getAsteroidStars(asteroidScore),
        accuracy: getAccuracyStars(accuracy),
        fuel: getFuelStars(fuelConsumed),
        hull: getHullStars(hullDamage),
        total: 0
    };
    stars.total = stars.asteroids + stars.accuracy + stars.fuel + stars.hull;

    return {
        asteroidScore,
        bonuses,
        finalScore,
        stars
    };
}

/**
 * Calculate asteroid stars based on score earned
 * Note: This is a rough heuristic; actual thresholds may need tuning per level
 */
function getAsteroidStars(asteroidScore: number): number {
    // Assumes average ~20,000 pts for good performance
    if (asteroidScore >= 25000) return 3;
    if (asteroidScore >= 15000) return 2;
    if (asteroidScore >= 8000) return 1;
    return 0;
}

/**
 * Calculate accuracy stars based on hit percentage
 * @param accuracy - Shot accuracy percentage (0-100)
 * @returns 0-3 stars
 */
function getAccuracyStars(accuracy: number): number {
    if (accuracy >= 80) return 3;
    if (accuracy >= 50) return 2;
    if (accuracy >= 20) return 1;
    return 0;
}

/**
 * Calculate fuel efficiency stars
 * @param fuelConsumed - Fuel consumed percentage (0-300+%)
 * @returns 0-3 stars
 */
function getFuelStars(fuelConsumed: number): number {
    if (fuelConsumed <= 50) return 3;
    if (fuelConsumed <= 150) return 2;
    if (fuelConsumed <= 250) return 1;
    return 0;
}

/**
 * Calculate hull integrity stars
 * @param hullDamage - Hull damage percentage (0-300+%)
 * @returns 0-3 stars
 */
function getHullStars(hullDamage: number): number {
    if (hullDamage <= 30) return 3;
    if (hullDamage <= 100) return 2;
    if (hullDamage <= 200) return 1;
    return 0;
}

/**
 * Get star rating color based on count
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
 * @param earned - Number of stars earned (0-3)
 * @param total - Total possible stars (default: 3)
 * @returns Unicode star string (e.g., "★★☆")
 */
export function formatStars(earned: number, total: number = 3): string {
    const filled = '★'.repeat(Math.min(earned, total));
    const empty = '☆'.repeat(Math.max(0, total - earned));
    return filled + empty;
}
