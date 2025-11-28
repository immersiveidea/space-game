/**
 * Admin management script for Supabase
 *
 * Usage:
 *   npm run admin:add -- --user-id="facebook|123" --name="John" --email="john@example.com"
 *   npm run admin:add -- --user-id="facebook|123" --super   # Add as super admin (all permissions)
 *   npm run admin:list                                       # List all admins
 *   npm run admin:remove -- --user-id="facebook|123"         # Remove admin
 *
 * Required .env variables:
 *   SUPABASE_DB_URL - Direct DB connection string
 */

import postgres from 'postgres';
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

// Parse command line args
const args = process.argv.slice(2);
const command = args[0]; // 'add', 'list', 'remove'

function getArg(name: string): string | null {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : null;
}

function hasFlag(name: string): boolean {
    return args.includes(`--${name}`);
}

async function addAdmin() {
    const userId = getArg('user-id');
    const displayName = getArg('name') || null;
    const email = getArg('email') || null;
    const isSuper = hasFlag('super');

    if (!userId) {
        console.error('Missing required --user-id argument');
        console.error('Usage: npm run admin:add -- --user-id="facebook|123" --name="John" [--super]');
        process.exit(1);
    }

    console.log(`\nAdding admin: ${userId}`);
    if (isSuper) {
        console.log('  Type: Super Admin (all permissions)');
    }

    try {
        const result = await sql`
            INSERT INTO admins (
                user_id,
                display_name,
                email,
                can_review_levels,
                can_manage_admins,
                can_manage_official,
                can_view_analytics,
                is_active
            ) VALUES (
                ${userId},
                ${displayName},
                ${email},
                true,
                ${isSuper},
                ${isSuper},
                ${isSuper},
                true
            )
            ON CONFLICT (user_id) DO UPDATE SET
                display_name = COALESCE(EXCLUDED.display_name, admins.display_name),
                email = COALESCE(EXCLUDED.email, admins.email),
                can_review_levels = true,
                can_manage_admins = ${isSuper} OR admins.can_manage_admins,
                can_manage_official = ${isSuper} OR admins.can_manage_official,
                can_view_analytics = ${isSuper} OR admins.can_view_analytics,
                is_active = true
            RETURNING *
        `;

        console.log('\n✓ Admin added/updated successfully!');
        console.log('\nPermissions:');
        console.log(`  can_review_levels:  ${result[0].can_review_levels}`);
        console.log(`  can_manage_admins:  ${result[0].can_manage_admins}`);
        console.log(`  can_manage_official: ${result[0].can_manage_official}`);
        console.log(`  can_view_analytics: ${result[0].can_view_analytics}`);
    } catch (error: any) {
        console.error('Failed to add admin:', error.message);
        process.exit(1);
    }
}

async function listAdmins() {
    console.log('\nCurrent Admins:\n');

    const admins = await sql`
        SELECT
            user_id,
            display_name,
            email,
            can_review_levels,
            can_manage_admins,
            can_manage_official,
            can_view_analytics,
            is_active,
            expires_at,
            created_at
        FROM admins
        ORDER BY created_at
    `;

    if (admins.length === 0) {
        console.log('  No admins found.');
        return;
    }

    for (const admin of admins) {
        const status = admin.is_active ? '✓ active' : '✗ inactive';
        const perms = [
            admin.can_review_levels ? 'review' : null,
            admin.can_manage_admins ? 'manage_admins' : null,
            admin.can_manage_official ? 'manage_official' : null,
            admin.can_view_analytics ? 'analytics' : null,
        ].filter(Boolean).join(', ');

        console.log(`  ${admin.user_id}`);
        console.log(`    Name: ${admin.display_name || '(not set)'}`);
        console.log(`    Email: ${admin.email || '(not set)'}`);
        console.log(`    Status: ${status}`);
        console.log(`    Permissions: ${perms || 'none'}`);
        if (admin.expires_at) {
            console.log(`    Expires: ${admin.expires_at}`);
        }
        console.log('');
    }

    console.log(`Total: ${admins.length} admin(s)`);
}

async function removeAdmin() {
    const userId = getArg('user-id');

    if (!userId) {
        console.error('Missing required --user-id argument');
        console.error('Usage: npm run admin:remove -- --user-id="facebook|123"');
        process.exit(1);
    }

    console.log(`\nRemoving admin: ${userId}`);

    const result = await sql`
        DELETE FROM admins WHERE user_id = ${userId} RETURNING user_id
    `;

    if (result.length === 0) {
        console.log('  Admin not found.');
    } else {
        console.log('✓ Admin removed successfully!');
    }
}

async function main() {
    try {
        switch (command) {
            case 'add':
                await addAdmin();
                break;
            case 'list':
                await listAdmins();
                break;
            case 'remove':
                await removeAdmin();
                break;
            default:
                console.log('Admin Management Script\n');
                console.log('Commands:');
                console.log('  npm run admin:add -- --user-id="id" [--name="Name"] [--email="email"] [--super]');
                console.log('  npm run admin:list');
                console.log('  npm run admin:remove -- --user-id="id"');
                break;
        }
    } finally {
        await sql.end();
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    sql.end();
    process.exit(1);
});
