/**
 * Seed script for populating official levels from JSON files
 *
 * Usage:
 *   npm run seed:levels                    # Seed all levels from directory.json
 *   npm run seed:levels -- --clean         # Delete all official levels first
 *   npm run seed:levels -- --admin-id="facebook|123"  # Specify admin user ID
 *
 * Required .env variables:
 *   SUPABASE_DB_URL - Direct DB connection string
 *
 * Note: Requires an admin user with can_manage_official permission.
 * The script will use the first super admin found, or you can specify --admin-id.
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
    console.error('Missing SUPABASE_DB_URL environment variable.');
    process.exit(1);
}

const sql = postgres(DATABASE_URL);

const LEVELS_DIR = path.join(__dirname, '..', 'public', 'levels');
const DIRECTORY_FILE = path.join(LEVELS_DIR, 'directory.json');

interface DirectoryEntry {
    id: string;
    name: string;
    description: string;
    version: string;
    levelPath: string;
    difficulty: string;
    estimatedTime: string;
    missionBrief: string[];
    unlockRequirements: string[];
    tags: string[];
    defaultLocked: boolean;
}

interface Directory {
    version: string;
    levels: DirectoryEntry[];
}

// Parse command line args
const args = process.argv.slice(2);
const cleanFirst = args.includes('--clean');
const adminIdArg = args.find(a => a.startsWith('--admin-id='));
const specifiedAdminId = adminIdArg ? adminIdArg.split('=')[1] : null;

/**
 * Get an admin's internal user ID (UUID) with manage_official permission
 */
async function getAdminInternalUserId(): Promise<string> {
    if (specifiedAdminId) {
        // Verify the specified admin exists and has permission
        const admin = await sql`
            SELECT internal_user_id FROM admins
            WHERE user_id = ${specifiedAdminId}
            AND is_active = true
            AND can_manage_official = true
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        if (admin.length === 0) {
            throw new Error(`Admin ${specifiedAdminId} not found or lacks manage_official permission`);
        }
        if (!admin[0].internal_user_id) {
            throw new Error(`Admin ${specifiedAdminId} has no internal user ID. Run migration 002 first.`);
        }
        return admin[0].internal_user_id;
    }

    // Find any admin with manage_official permission
    const admins = await sql`
        SELECT internal_user_id FROM admins
        WHERE is_active = true
        AND can_manage_official = true
        AND internal_user_id IS NOT NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
    `;

    if (admins.length === 0) {
        throw new Error('No admin found with manage_official permission and internal user ID. Run admin:add first.');
    }

    return admins[0].internal_user_id;
}

/**
 * Clean existing official levels
 */
async function cleanOfficialLevels(): Promise<void> {
    console.log('\nDeleting existing official levels...');

    const result = await sql`
        DELETE FROM levels WHERE level_type = 'official' RETURNING id
    `;

    console.log(`  Deleted ${result.length} official level(s)`);
}

/**
 * Seed levels from directory.json
 */
async function seedLevels(): Promise<void> {
    // Read directory.json
    if (!fs.existsSync(DIRECTORY_FILE)) {
        throw new Error(`Directory file not found: ${DIRECTORY_FILE}`);
    }

    const directory: Directory = JSON.parse(fs.readFileSync(DIRECTORY_FILE, 'utf-8'));
    console.log(`\nFound ${directory.levels.length} levels in directory.json (v${directory.version})`);

    // Get admin's internal user ID (UUID)
    const adminUserId = await getAdminInternalUserId();
    console.log(`Using admin internal ID: ${adminUserId}\n`);

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < directory.levels.length; i++) {
        const entry = directory.levels[i];
        const levelPath = path.join(LEVELS_DIR, entry.levelPath);

        process.stdout.write(`  [${i + 1}/${directory.levels.length}] ${entry.name}... `);

        // Check if level config file exists
        if (!fs.existsSync(levelPath)) {
            console.log('✗ config file not found');
            failed++;
            continue;
        }

        try {
            // Read level config
            const config = JSON.parse(fs.readFileSync(levelPath, 'utf-8'));

            // Upsert the level
            const result = await sql`
                INSERT INTO levels (
                    user_id,
                    slug,
                    name,
                    description,
                    difficulty,
                    estimated_time,
                    tags,
                    config,
                    mission_brief,
                    level_type,
                    sort_order,
                    unlock_requirements,
                    default_locked
                ) VALUES (
                    ${adminUserId},
                    ${entry.id},
                    ${entry.name},
                    ${entry.description},
                    ${entry.difficulty},
                    ${entry.estimatedTime},
                    ${entry.tags},
                    ${JSON.stringify(config)},
                    ${entry.missionBrief},
                    'official',
                    ${i},
                    ${entry.unlockRequirements},
                    ${entry.defaultLocked}
                )
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    difficulty = EXCLUDED.difficulty,
                    estimated_time = EXCLUDED.estimated_time,
                    tags = EXCLUDED.tags,
                    config = EXCLUDED.config,
                    mission_brief = EXCLUDED.mission_brief,
                    sort_order = EXCLUDED.sort_order,
                    unlock_requirements = EXCLUDED.unlock_requirements,
                    default_locked = EXCLUDED.default_locked,
                    updated_at = NOW()
                RETURNING (xmax = 0) as is_insert
            `;

            if (result[0].is_insert) {
                console.log('✓ inserted');
                inserted++;
            } else {
                console.log('✓ updated');
                updated++;
            }
        } catch (error: any) {
            console.log(`✗ ${error.message}`);
            failed++;
        }
    }

    console.log('\n----------------------------------------');
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated:  ${updated}`);
    console.log(`Failed:   ${failed}`);
    console.log(`Total:    ${directory.levels.length}`);

    if (failed === 0) {
        console.log('\n✓ All levels seeded successfully!');
    } else {
        console.log('\n⚠ Some levels failed to seed');
    }
}

async function main() {
    try {
        if (cleanFirst) {
            await cleanOfficialLevels();
        }
        await seedLevels();
    } finally {
        await sql.end();
    }
}

main().catch((error) => {
    console.error('\nSeeding failed:', error.message);
    sql.end();
    process.exit(1);
});
