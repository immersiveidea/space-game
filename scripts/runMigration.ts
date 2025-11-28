/**
 * Migration runner for Supabase database
 *
 * Usage:
 *   npm run migrate                     # Run all pending migrations
 *   npm run migrate -- --file=001_cloud_levels.sql  # Run specific migration
 *   npm run migrate -- --status         # Show migration status
 *
 * Required .env variables:
 *   SUPABASE_DB_URL - Direct DB connection string (Settings → Database → URI)
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
    console.error('Get it from Supabase → Settings → Database → Connection string (URI)');
    console.error('Use the "Session pooler" connection string for IPv4 compatibility.');
    process.exit(1);
}

const sql = postgres(DATABASE_URL);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable(): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            executed_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;
}

/**
 * Get list of already executed migrations
 */
async function getExecutedMigrations(): Promise<string[]> {
    const result = await sql`SELECT name FROM _migrations ORDER BY id`;
    return result.map(row => row.name);
}

/**
 * Get list of migration files
 */
function getMigrationFiles(): string[] {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
        process.exit(1);
    }

    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
}

/**
 * Run a single migration file
 */
async function runMigration(filename: string): Promise<void> {
    const filepath = path.join(MIGRATIONS_DIR, filename);

    if (!fs.existsSync(filepath)) {
        throw new Error(`Migration file not found: ${filepath}`);
    }

    const content = fs.readFileSync(filepath, 'utf-8');

    console.log(`  Running: ${filename}...`);

    try {
        // Execute the migration
        await sql.unsafe(content);

        // Record the migration
        await sql`INSERT INTO _migrations (name) VALUES (${filename})`;

        console.log(`  ✓ ${filename} completed`);
    } catch (error) {
        console.error(`  ✗ ${filename} failed:`, error.message);
        throw error;
    }
}

/**
 * Run all pending migrations
 */
async function runAllMigrations(): Promise<void> {
    await ensureMigrationsTable();

    const executed = await getExecutedMigrations();
    const files = getMigrationFiles();
    const pending = files.filter(f => !executed.includes(f));

    if (pending.length === 0) {
        console.log('No pending migrations.');
        return;
    }

    console.log(`\nRunning ${pending.length} migration(s):\n`);

    for (const file of pending) {
        await runMigration(file);
    }

    console.log('\n✓ All migrations completed successfully!');
}

/**
 * Show migration status
 */
async function showStatus(): Promise<void> {
    await ensureMigrationsTable();

    const executed = await getExecutedMigrations();
    const files = getMigrationFiles();

    console.log('\nMigration Status:\n');
    console.log('  File                              Status');
    console.log('  --------------------------------  --------');

    for (const file of files) {
        const status = executed.includes(file) ? '✓ done' : '○ pending';
        console.log(`  ${file.padEnd(34)} ${status}`);
    }

    const pending = files.filter(f => !executed.includes(f));
    console.log(`\n  Total: ${files.length} | Done: ${executed.length} | Pending: ${pending.length}\n`);
}

// Parse command line args
const args = process.argv.slice(2);
const showStatusFlag = args.includes('--status');
const fileArg = args.find(arg => arg.startsWith('--file='));
const specificFile = fileArg ? fileArg.split('=')[1] : null;

async function main() {
    try {
        if (showStatusFlag) {
            await showStatus();
        } else if (specificFile) {
            await ensureMigrationsTable();
            const executed = await getExecutedMigrations();

            if (executed.includes(specificFile)) {
                console.log(`Migration ${specificFile} has already been executed.`);
                console.log('To re-run, manually delete it from _migrations table first.');
            } else {
                console.log(`\nRunning specific migration:\n`);
                await runMigration(specificFile);
                console.log('\n✓ Migration completed!');
            }
        } else {
            await runAllMigrations();
        }
    } finally {
        await sql.end();
    }
}

main().catch((error) => {
    console.error('\nMigration failed:', error.message);
    sql.end();
    process.exit(1);
});
