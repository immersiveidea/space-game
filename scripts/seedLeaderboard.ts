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

// Levels from directory.json
const LEVELS = [
    { id: 'rookie-training', name: 'Rookie Training', difficulty: 'recruit' },
    { id: 'asteroid-mania', name: 'Asteroid Mania!!!', difficulty: 'recruit' },
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

function generateFakeEntry() {
    const level = LEVELS[randomInt(0, LEVELS.length - 1)];
    const endReasonObj = weightedRandom(END_REASONS);
    const completed = endReasonObj.reason === 'victory';

    // Harder levels tend to have lower scores
    const difficultyMultiplier = {
        'recruit': 1.0,
        'pilot': 0.9,
        'captain': 0.8,
        'commander': 0.7,
    }[level.difficulty] || 0.8;

    // Generate stats
    const totalAsteroids = randomInt(5, 50);
    const asteroidsDestroyed = completed
        ? totalAsteroids
        : randomInt(Math.floor(totalAsteroids * 0.2), totalAsteroids - 1);

    const accuracy = completed
        ? randomFloat(50, 95)
        : randomFloat(30, 70);

    const gameTimeSeconds = randomInt(60, 300);
    const hullDamageTaken = completed
        ? randomFloat(0, 60)
        : randomFloat(40, 100);

    const fuelConsumed = completed
        ? randomFloat(20, 80)
        : randomFloat(50, 100);

    // Calculate score (simplified version)
    const baseScore = asteroidsDestroyed * 1000;
    const accuracyBonus = Math.floor(accuracy * 10);
    const timeBonus = Math.max(0, 300 - gameTimeSeconds);
    const survivalBonus = completed ? 500 : 0;
    const finalScore = Math.floor((baseScore + accuracyBonus + timeBonus + survivalBonus) * difficultyMultiplier);

    // Star rating based on performance (0-12)
    const starRating = completed
        ? randomInt(4, 12)
        : randomInt(0, 4);

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
