import {LevelConfig} from "../config/levelConfig";

const LEGACY_STORAGE_KEY = 'space-game-levels';
const ARCHIVE_STORAGE_KEY = 'space-game-levels-archive';
const CUSTOM_LEVELS_KEY = 'space-game-custom-levels';
const MIGRATION_STATUS_KEY = 'space-game-migration-status';

/**
 * Migration status information
 */
interface MigrationStatus {
    migrated: boolean;
    migratedAt?: Date;
    version: string;
    customLevelsMigrated: number;
    defaultLevelsRemoved: number;
}

/**
 * Result of migration operation
 */
interface MigrationResult {
    success: boolean;
    customLevelsMigrated: number;
    defaultLevelsFound: number;
    error?: string;
    legacyDataArchived: boolean;
}

/**
 * Handles migration from legacy localStorage format to new hybrid system
 */
export class LegacyMigration {
    private static readonly MIGRATION_VERSION = '2.0';

    /**
     * Check if migration is needed
     */
    public static needsMigration(): boolean {
        // Check if migration was already completed
        const status = this.getMigrationStatus();
        if (status && status.migrated) {
            return false;
        }

        // Check if legacy data exists
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        return legacyData !== null && legacyData.length > 0;
    }

    /**
     * Get current migration status
     */
    public static getMigrationStatus(): MigrationStatus | null {
        const stored = localStorage.getItem(MIGRATION_STATUS_KEY);
        if (!stored) {
            return null;
        }

        try {
            const status: MigrationStatus = JSON.parse(stored);
            if (status.migratedAt && typeof status.migratedAt === 'string') {
                status.migratedAt = new Date(status.migratedAt);
            }
            return status;
        } catch (error) {
            console.error('Failed to parse migration status:', error);
            return null;
        }
    }

    /**
     * Perform the migration
     */
    public static migrate(): MigrationResult {
        const result: MigrationResult = {
            success: false,
            customLevelsMigrated: 0,
            defaultLevelsFound: 0,
            legacyDataArchived: false
        };

        try {
            // Load legacy data
            const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (!legacyData) {
                result.error = 'No legacy data found';
                return result;
            }

            const legacyLevels: [string, LevelConfig][] = JSON.parse(legacyData);

            // Separate custom from default levels
            const customLevels: [string, LevelConfig][] = [];

            for (const [name, config] of legacyLevels) {
                if (config.metadata?.type === 'default') {
                    result.defaultLevelsFound++;
                    // Skip default levels - they'll be loaded from JSON files now
                } else {
                    customLevels.push([name, config]);
                    result.customLevelsMigrated++;
                }
            }

            // Save custom levels to new storage location
            if (customLevels.length > 0) {
                localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(customLevels));
            }

            // Archive legacy data (don't delete immediately)
            this.archiveLegacyData(legacyData);
            result.legacyDataArchived = true;

            // Clear legacy storage key
            localStorage.removeItem(LEGACY_STORAGE_KEY);

            // Record migration status
            const status: MigrationStatus = {
                migrated: true,
                migratedAt: new Date(),
                version: this.MIGRATION_VERSION,
                customLevelsMigrated: result.customLevelsMigrated,
                defaultLevelsRemoved: result.defaultLevelsFound
            };
            localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status));

            result.success = true;

            console.log('Migration completed:', result);
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
            console.error('Migration failed:', error);
        }

        return result;
    }

    /**
     * Archive legacy data for potential recovery
     */
    private static archiveLegacyData(legacyData: string): void {
        const archive = {
            data: legacyData,
            archivedAt: new Date().toISOString(),
            migrationVersion: this.MIGRATION_VERSION
        };

        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archive));
    }

    /**
     * Get archived legacy data (for export/recovery)
     */
    public static getArchivedData(): string | null {
        const stored = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (!stored) {
            return null;
        }

        try {
            const archive = JSON.parse(stored);
            return archive.data || null;
        } catch (error) {
            console.error('Failed to parse archived data:', error);
            return null;
        }
    }

    /**
     * Export legacy data as JSON file
     */
    public static exportLegacyData(): string | null {
        const archivedData = this.getArchivedData();
        if (!archivedData) {
            return null;
        }

        try {
            const levels: [string, LevelConfig][] = JSON.parse(archivedData);
            const exportData = {
                exportedAt: new Date().toISOString(),
                migrationVersion: this.MIGRATION_VERSION,
                levels: Object.fromEntries(levels)
            };

            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Failed to export legacy data:', error);
            return null;
        }
    }

    /**
     * Download legacy data as JSON file
     */
    public static downloadLegacyData(): void {
        const jsonString = this.exportLegacyData();
        if (!jsonString) {
            console.warn('No legacy data to download');
            return;
        }

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legacy-levels-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Clear archived data (after user confirms backup)
     */
    public static clearArchive(): void {
        localStorage.removeItem(ARCHIVE_STORAGE_KEY);
    }

    /**
     * Reset migration status (for testing/debugging)
     */
    public static resetMigration(): void {
        localStorage.removeItem(MIGRATION_STATUS_KEY);
        console.log('Migration status reset');
    }

    /**
     * Full reset - clear all migration data (dangerous!)
     */
    public static fullReset(): void {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        localStorage.removeItem(ARCHIVE_STORAGE_KEY);
        localStorage.removeItem(CUSTOM_LEVELS_KEY);
        localStorage.removeItem(MIGRATION_STATUS_KEY);
        console.log('Full migration reset completed');
    }

    /**
     * Create and show migration modal UI
     */
    public static showMigrationModal(onComplete: (result: MigrationResult) => void): void {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: 'Courier New', monospace;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #1a1a1a;
            border: 2px solid #00ff00;
            padding: 30px;
            max-width: 600px;
            color: #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        `;

        content.innerHTML = `
            <h2 style="margin-top: 0; color: #00ff00;">Level System Updated</h2>
            <p>The level storage system has been upgraded!</p>
            <p><strong>Changes:</strong></p>
            <ul>
                <li>Default levels now load from game files (always available)</li>
                <li>Your custom levels remain in browser storage</li>
                <li>Version tracking and update notifications enabled</li>
                <li>Level statistics and performance tracking added</li>
            </ul>
            <p><strong>Your data will be migrated automatically.</strong></p>
            <p>A backup of your old level data will be saved.</p>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button id="export-backup" style="padding: 10px 20px; background: #004400; color: #00ff00; border: 1px solid #00ff00; cursor: pointer;">
                    Export Backup
                </button>
                <button id="migrate-now" style="padding: 10px 20px; background: #006600; color: #00ff00; border: 1px solid #00ff00; cursor: pointer; font-weight: bold;">
                    Migrate Now
                </button>
            </div>
            <p id="migration-status" style="margin-top: 15px; font-size: 0.9em; color: #ffff00; display: none;"></p>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        const exportBtn = content.querySelector('#export-backup') as HTMLButtonElement;
        const migrateBtn = content.querySelector('#migrate-now') as HTMLButtonElement;
        const statusText = content.querySelector('#migration-status') as HTMLParagraphElement;

        exportBtn.addEventListener('click', () => {
            this.downloadLegacyData();
            statusText.textContent = 'Backup downloaded! You can now proceed with migration.';
            statusText.style.display = 'block';
        });

        migrateBtn.addEventListener('click', () => {
            statusText.textContent = 'Migrating...';
            statusText.style.display = 'block';
            statusText.style.color = '#ffff00';

            // Give UI time to update
            setTimeout(() => {
                const result = this.migrate();

                if (result.success) {
                    statusText.textContent = `Migration complete! ${result.customLevelsMigrated} custom levels migrated.`;
                    statusText.style.color = '#00ff00';

                    setTimeout(() => {
                        document.body.removeChild(modal);
                        onComplete(result);
                    }, 2000);
                } else {
                    statusText.textContent = `Migration failed: ${result.error}`;
                    statusText.style.color = '#ff0000';
                }
            }, 100);
        });
    }
}
