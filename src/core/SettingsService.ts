import type Database from 'better-sqlite3';
import { inject, singleton } from 'tsyringe';
import { DatabaseProvider } from './DatabaseProvider';

export const SETTING_DEFAULT_VOICE = 'polly.defaultVoice';
export const SETTING_FISH_DEFAULT_REFERENCE_ID = 'fish.defaultReferenceId';

interface SettingRow {
  value: string;
}

@singleton()
export class SettingsService {
  private readonly getStmt: Database.Statement<[string], SettingRow>;
  private readonly upsertStmt: Database.Statement<[string, string]>;
  private readonly deleteStmt: Database.Statement<[string]>;

  constructor(@inject(DatabaseProvider) database: DatabaseProvider) {
    database.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.getStmt = database.db.prepare('SELECT value FROM settings WHERE key = ?');
    this.upsertStmt = database.db.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    );
    this.deleteStmt = database.db.prepare('DELETE FROM settings WHERE key = ?');
  }

  get(key: string): string | undefined {
    return this.getStmt.get(key)?.value;
  }

  set(key: string, value: string): void {
    this.upsertStmt.run(key, value);
  }

  delete(key: string): void {
    this.deleteStmt.run(key);
  }
}
