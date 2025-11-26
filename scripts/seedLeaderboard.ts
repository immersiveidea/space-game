/**
 * Seed script for populating leaderboard with fake test data
 *
 * Usage:
 *   npm run seed:leaderboard              # Insert 250 fake entries
 *   npm run seed:leaderboard -- --count=50  # Insert 50 fake entries
 *   npm run seed:leaderboard:clean        # Delete all test data
 *
 * Required .env variables:
 *   VITE_SUPABASE_PROJECT  - Supabase project URL
 *   SUPABASE_SERVICE_KEY   - Service role key (Settings → API)
 *   SUPABASE_DB_URL        - Direct DB connection string (Settings → Database → URI)
 *
 * The script will automatically create the is_test_data column if it doesn't exist.
 */

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_PROJECT;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing required environment variables:');
    if (!SUPABASE_URL) console.error('  - VITE_SUPABASE_PROJECT');
    if (!SUPABASE_SERVICE_KEY) console.error('  - SUPABASE_SERVICE_KEY');
    console.error('\nMake sure these are set in your .env file');
    process.exit(1);
}

if (!DATABASE_URL) {
    console.error('Missing SUPABASE_DB_URL environment variable.');
    console.error('Get it from Supabase → Settings → Database → Connection string (URI)');
    console.error('Format: postgresql://postgres:[password]@[host]:5432/postgres');
    process.exit(1);
}

// Create Supabase client with service key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Create direct Postgres connection for DDL operations
const sql = postgres(DATABASE_URL);

/**
 * Check if is_test_data column exists, create it if not
 */
async function ensureTestDataColumn(): Promise<void> {
    console.log('Checking for is_test_data column...');

    // Check if column exists using information_schema
    const result = await sql`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'leaderboard' AND column_name = 'is_test_data'
        ) as exists
    `;

    if (result[0]?.exists) {
        console.log('  Column exists ✓');
        return;
    }

    console.log('  Column missing - creating...');

    // Add the column
    await sql`
        ALTER TABLE leaderboard
        ADD COLUMN is_test_data BOOLEAN NOT NULL DEFAULT false
    `;

    // Create partial index for efficient cleanup queries
    await sql`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_test_data
        ON leaderboard(is_test_data)
        WHERE is_test_data = true
    `;

    console.log('  Column and index created ✓');
}

// Levels from directory.json with actual config values
const LEVELS = [
    {
        id: 'rookie-training',
        name: 'Rookie Training',
        difficulty: 'recruit',
        asteroids: 5,
        parTime: 120  // 2 minutes expected
    },
    {
        id: 'asteroid-mania',
        name: 'Asteroid Mania!!!',
        difficulty: 'pilot',
        asteroids: 12,
        parTime: 180  // 3 minutes expected (more asteroids, farther away)
    },
];

// Pool of realistic player names
const PLAYER_NAMES = [
    'AceOfSpace', 'StarPilot_X', 'CosmicCrusader', 'VoidWalker', 'NebulaNinja',
    'AstroAce', 'GalaxyGlider', 'SpaceRaider', 'OrbitRunner', 'CometChaser',
    'MeteorMaster', 'PulsarPilot', 'QuasarQueen', 'StellarStrike', 'NovaNavigator',
    'DarkMatterDan', 'EventHorizon', 'BlackHoleBob', 'WarpDriveWill', 'LightSpeedLou',
    'RocketRider', 'JetStreamJane', 'ThrusterTom', 'BoosterBeth', 'FuelCellFred',
    'ShieldMaster', 'LaserLarry', 'PlasmaPatty', 'PhotonPhil', 'IonIvy',
    'ZeroGravZach', 'FloatingFrank', 'DriftingDiana', 'WeightlessWendy', 'FreeFloater',
    'CommanderCole', 'CaptainKira', 'LtLunar', 'EnsignElla', 'AdmiralAlex',
    'TheDestroyer', 'RockBreaker', 'AsteroidAnnie', 'BoulderBuster', 'StoneSlayer',
    'SpeedDemon', 'QuickShot', 'FastFingers', 'RapidReflexes', 'SwiftStrike'
];

// End reasons with weights
const END_REASONS = [
    { reason: 'victory', weight: 70 },
    { reason: 'death', weight: 20 },
    { reason: 'stranded', weight: 10 },
];

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return parseFloat(value.toFixed(decimals));
}

function weightedRandom<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        random -= item.weight;
        if (random <= 0) return item;
    }
    return items[items.length - 1];
}

function randomDate(daysBack: number): string {
    const now = new Date();
    const pastDate = new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
    return pastDate.toISOString();
}

/**
 * Calculate score using the actual game's scoring formula
 * Base: 10,000 × timeMultiplier × accuracyMultiplier × fuelMultiplier × hullMultiplier
 */
function calculateScore(
    gameTime: number,
    parTime: number,
    accuracy: number,
    fuelConsumed: number,
    hullDamage: number
): number {
    const BASE_SCORE = 10000;

    // Time multiplier: exponential decay from par time (0.1x to 3.0x)
    const timeRatio = gameTime / parTime;
    const timeMultiplier = Math.min(3.0, Math.max(0.1, Math.exp(-timeRatio + 1) * 2));

    // Accuracy multiplier: 1.0x to 2.0x
    const accuracyMultiplier = 1.0 + (accuracy / 100);

    // Fuel efficiency multiplier: 0.5x to 2.0x
    const fuelMultiplier = Math.max(0.5, 1.0 + ((100 - fuelConsumed) / 100));

    // Hull integrity multiplier: 0.5x to 2.0x
    const hullMultiplier = Math.max(0.5, 1.0 + ((100 - hullDamage) / 100));

    return Math.floor(BASE_SCORE * timeMultiplier * accuracyMultiplier * fuelMultiplier * hullMultiplier);
}

/**
 * Calculate star rating using the actual game's star system (0-12 total)
 */
function calculateStars(
    gameTime: number,
    parTime: number,
    accuracy: number,
    fuelConsumed: number,
    hullDamage: number
): number {
    const timeRatio = gameTime / parTime;

    // Time stars (3 = ≤50% par, 2 = ≤100%, 1 = ≤150%, 0 = >150%)
    const timeStars = timeRatio <= 0.5 ? 3 : timeRatio <= 1.0 ? 2 : timeRatio <= 1.5 ? 1 : 0;

    // Accuracy stars (3 = ≥75%, 2 = ≥50%, 1 = ≥25%, 0 = <25%)
    const accuracyStars = accuracy >= 75 ? 3 : accuracy >= 50 ? 2 : accuracy >= 25 ? 1 : 0;

    // Fuel stars (3 = ≤30%, 2 = ≤60%, 1 = ≤80%, 0 = >80%)
    const fuelStars = fuelConsumed <= 30 ? 3 : fuelConsumed <= 60 ? 2 : fuelConsumed <= 80 ? 1 : 0;

    // Hull stars (3 = ≤10%, 2 = ≤30%, 1 = ≤60%, 0 = >60%)
    const hullStars = hullDamage <= 10 ? 3 : hullDamage <= 30 ? 2 : hullDamage <= 60 ? 1 : 0;

    return timeStars + accuracyStars + fuelStars + hullStars;
}

function generateFakeEntry() {
    const level = LEVELS[randomInt(0, LEVELS.length - 1)];
    const endReasonObj = weightedRandom(END_REASONS);
    const completed = endReasonObj.reason === 'victory';

    // Use level-specific asteroid count
    const totalAsteroids = level.asteroids;
    const asteroidsDestroyed = completed
        ? totalAsteroids
        : randomInt(Math.floor(totalAsteroids * 0.3), totalAsteroids - 1);

    // Generate realistic stats based on 2-5 minute gameplay
    let gameTimeSeconds: number;
    let accuracy: number;
    let hullDamageTaken: number;
    let fuelConsumed: number;

    if (completed) {
        // Victory: 2-5 minutes, decent stats
        gameTimeSeconds = randomInt(level.parTime * 0.8, level.parTime * 2.5); // 80% to 250% of par
        accuracy = randomFloat(45, 85);           // Most players hit 45-85%
        hullDamageTaken = randomFloat(5, 55);     // Some damage but survived
        fuelConsumed = randomFloat(25, 70);       // Used fuel but made it back
    } else if (endReasonObj.reason === 'death') {
        // Death: Usually faster (died before completing), worse stats
        gameTimeSeconds = randomInt(level.parTime * 0.5, level.parTime * 1.5);
        accuracy = randomFloat(25, 60);           // Struggled with aim
        hullDamageTaken = randomFloat(80, 100);   // Took fatal damage
        fuelConsumed = randomFloat(30, 80);       // Died before fuel was an issue
    } else {
        // Stranded: Ran out of fuel far from base
        gameTimeSeconds = randomInt(level.parTime * 1.5, level.parTime * 3);
        accuracy = randomFloat(35, 70);           // Okay aim
        hullDamageTaken = randomFloat(20, 60);    // Some damage
        fuelConsumed = randomFloat(95, 100);      // Ran out of fuel!
    }

    // Calculate score and stars using actual game formulas
    const finalScore = completed
        ? calculateScore(gameTimeSeconds, level.parTime, accuracy, fuelConsumed, hullDamageTaken)
        : Math.floor(calculateScore(gameTimeSeconds, level.parTime, accuracy, fuelConsumed, hullDamageTaken) * 0.3); // 30% penalty for not completing

    const starRating = calculateStars(gameTimeSeconds, level.parTime, accuracy, fuelConsumed, hullDamageTaken);

    return {
        user_id: `test-data|fake-${randomInt(1000, 9999)}`,
        player_name: PLAYER_NAMES[randomInt(0, PLAYER_NAMES.length - 1)],
        level_id: level.id,
        level_name: level.name,
        completed,
        end_reason: endReasonObj.reason,
        game_time_seconds: gameTimeSeconds,
        asteroids_destroyed: asteroidsDestroyed,
        total_asteroids: totalAsteroids,
        accuracy,
        hull_damage_taken: hullDamageTaken,
        fuel_consumed: fuelConsumed,
        final_score: finalScore,
        star_rating: starRating,
        created_at: randomDate(30), // Random date in last 30 days
        is_test_data: true,
    };
}

async function seedLeaderboard(count: number) {
    // Ensure column exists before seeding
    await ensureTestDataColumn();

    console.log(`\nSeeding leaderboard with ${count} fake entries...`);

    const entries = [];
    for (let i = 0; i < count; i++) {
        entries.push(generateFakeEntry());
    }

    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        const { data, error } = await supabase
            .from('leaderboard')
            .insert(batch)
            .select('id');

        if (error) {
            console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
            process.exit(1);
        }

        inserted += batch.length;
        console.log(`  Inserted ${inserted}/${count} entries...`);
    }

    console.log(`\nSuccessfully inserted ${inserted} fake leaderboard entries!`);
    console.log('To clean up, run: npm run seed:leaderboard:clean');
}

async function cleanTestData() {
    // Ensure column exists before cleaning
    await ensureTestDataColumn();

    console.log('\nDeleting all test data from leaderboard...');

    const { data, error, count } = await supabase
        .from('leaderboard')
        .delete()
        .eq('is_test_data', true)
        .select('id');

    if (error) {
        console.error('Error deleting test data:', error);
        process.exit(1);
    }

    const deletedCount = data?.length || 0;
    console.log(`Successfully deleted ${deletedCount} test entries!`);
}

// Parse command line args
const args = process.argv.slice(2);
const isClean = args.includes('--clean');
const countArg = args.find(arg => arg.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1], 10) : 250;

async function main() {
    try {
        if (isClean) {
            await cleanTestData();
        } else {
            if (isNaN(count) || count < 1) {
                console.error('Invalid count. Usage: npm run seed:leaderboard -- --count=100');
                process.exit(1);
            }
            await seedLeaderboard(count);
        }
    } finally {
        // Close postgres connection
        await sql.end();
    }
}

main().catch((error) => {
    console.error('Script failed:', error);
    sql.end();
    process.exit(1);
});
