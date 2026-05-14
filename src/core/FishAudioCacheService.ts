import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { inject, singleton } from 'tsyringe';
import { Config } from './Config';
import { DatabaseProvider } from './DatabaseProvider';

export interface FishCacheKey {
  referenceId: string;
  text: string;
  model: string;
  format: string;
}

export interface FishCacheEntry {
  id: number;
  referenceId: string;
  textOriginal: string;
  textNormalized: string;
  model: string;
  format: string;
  fileName: string;
  filePath: string;
  createdAt: string;
}

interface CacheRow {
  id: number;
  reference_id: string;
  text_normalized: string;
  text_original: string;
  model: string;
  format: string;
  file_name: string;
  created_at: string;
}

@singleton()
export class FishAudioCacheService {
  private readonly audioDir: string;
  private readonly enabled: boolean;
  private readonly findStmt: Database.Statement<[string, string, string, string], CacheRow>;
  private readonly insertStmt: Database.Statement<
    [string, string, string, string, string, string, string]
  >;
  private readonly deleteStmt: Database.Statement<[number]>;

  constructor(
    @inject(Config) config: Config,
    @inject(DatabaseProvider) database: DatabaseProvider,
  ) {
    this.enabled = config.get<boolean>('cache.enabled');
    this.audioDir = path.join(config.get<string>('cache.audioDir'), 'fish');
    fs.mkdirSync(this.audioDir, { recursive: true });

    database.db.exec(`
      CREATE TABLE IF NOT EXISTS fish_audio_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_id TEXT NOT NULL,
        text_normalized TEXT NOT NULL,
        text_original TEXT NOT NULL,
        model TEXT NOT NULL,
        format TEXT NOT NULL,
        file_name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        UNIQUE(reference_id, text_normalized, model, format)
      );
      CREATE INDEX IF NOT EXISTS idx_fish_audio_lookup
        ON fish_audio_cache(reference_id, text_normalized, model, format);
    `);

    this.findStmt = database.db.prepare(
      `SELECT * FROM fish_audio_cache
       WHERE reference_id = ? AND text_normalized = ? AND model = ? AND format = ?`,
    );
    this.insertStmt = database.db.prepare(
      `INSERT INTO fish_audio_cache
        (reference_id, text_normalized, text_original, model, format, file_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    this.deleteStmt = database.db.prepare('DELETE FROM fish_audio_cache WHERE id = ?');
  }

  find(key: FishCacheKey): FishCacheEntry | null {
    if (!this.enabled) return null;
    const normalized = FishAudioCacheService.normalize(key.text);
    const row = this.findStmt.get(key.referenceId, normalized, key.model, key.format);
    if (!row) return null;
    const entry = this.toEntry(row);
    if (!fs.existsSync(entry.filePath)) {
      this.deleteStmt.run(entry.id);
      return null;
    }
    return entry;
  }

  save(key: FishCacheKey, audio: Buffer): FishCacheEntry {
    const normalized = FishAudioCacheService.normalize(key.text);
    const fileName = FishAudioCacheService.fileNameFor(
      key.referenceId,
      normalized,
      key.model,
      key.format,
    );
    const filePath = path.join(this.audioDir, fileName);
    const createdAt = new Date().toISOString();

    fs.writeFileSync(filePath, audio);

    if (this.enabled) {
      try {
        this.insertStmt.run(
          key.referenceId,
          normalized,
          key.text,
          key.model,
          key.format,
          fileName,
          createdAt,
        );
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes('UNIQUE')) throw err;
      }
    }

    return {
      id: -1,
      referenceId: key.referenceId,
      textOriginal: key.text,
      textNormalized: normalized,
      model: key.model,
      format: key.format,
      fileName,
      filePath,
      createdAt,
    };
  }

  private toEntry(row: CacheRow): FishCacheEntry {
    return {
      id: row.id,
      referenceId: row.reference_id,
      textOriginal: row.text_original,
      textNormalized: row.text_normalized,
      model: row.model,
      format: row.format,
      fileName: row.file_name,
      filePath: path.join(this.audioDir, row.file_name),
      createdAt: row.created_at,
    };
  }

  private static normalize(text: string): string {
    return text.trim().toLowerCase();
  }

  private static fileNameFor(
    referenceId: string,
    normalized: string,
    model: string,
    format: string,
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${referenceId}::${model}::${format}::${normalized}`)
      .digest('hex')
      .slice(0, 32);
    const ext = format === 'wav' ? 'wav' : format === 'pcm' ? 'pcm' : format === 'opus' ? 'opus' : 'mp3';
    return `${hash}.${ext}`;
  }
}
