import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { inject, injectable } from 'tsyringe';
import { Config } from './Config';
import { CacheEntry, CacheLookupKey } from '../models/CacheEntry';
import { PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';

interface CacheRow {
  id: number;
  voice: string;
  text_normalized: string;
  text_original: string;
  format: string;
  file_name: string;
  created_at: string;
}

@injectable()
export class AudioCacheService {
  private readonly db: Database.Database;
  private readonly audioDir: string;
  private readonly enabled: boolean;

  private readonly findStmt: Database.Statement<[string, string, string], CacheRow>;
  private readonly insertStmt: Database.Statement<[
    string,
    string,
    string,
    string,
    string,
    string,
  ]>;
  private readonly deleteStmt: Database.Statement<[number]>;

  constructor(@inject(Config) private readonly config: Config) {
    this.enabled = this.config.get<boolean>('cache.enabled');
    this.audioDir = this.config.get<string>('cache.audioDir');
    const dbPath = this.config.get<string>('cache.dbPath');

    fs.mkdirSync(this.audioDir, { recursive: true });
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voice TEXT NOT NULL,
        text_normalized TEXT NOT NULL,
        text_original TEXT NOT NULL,
        format TEXT NOT NULL,
        file_name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        UNIQUE(voice, text_normalized, format)
      );
      CREATE INDEX IF NOT EXISTS idx_lookup
        ON cache_entries(voice, text_normalized, format);
    `);

    this.findStmt = this.db.prepare(
      'SELECT * FROM cache_entries WHERE voice = ? AND text_normalized = ? AND format = ?',
    );
    this.insertStmt = this.db.prepare(
      `INSERT INTO cache_entries
        (voice, text_normalized, text_original, format, file_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    this.deleteStmt = this.db.prepare('DELETE FROM cache_entries WHERE id = ?');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  find(key: CacheLookupKey): CacheEntry | null {
    if (!this.enabled) return null;
    const normalized = AudioCacheService.normalize(key.text);
    const row = this.findStmt.get(key.voice, normalized, key.format);
    if (!row) return null;

    const entry = this.toEntry(row);
    if (!fs.existsSync(entry.filePath)) {
      this.deleteStmt.run(entry.id);
      return null;
    }
    return entry;
  }

  save(key: CacheLookupKey, audio: Buffer): CacheEntry {
    const normalized = AudioCacheService.normalize(key.text);
    const fileName = AudioCacheService.fileNameFor(key.voice, normalized, key.format);
    const filePath = path.join(this.audioDir, fileName);
    const createdAt = new Date().toISOString();

    fs.writeFileSync(filePath, audio);

    if (this.enabled) {
      try {
        this.insertStmt.run(
          key.voice,
          normalized,
          key.text,
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
      voice: key.voice as PollyVoice,
      textNormalized: normalized,
      textOriginal: key.text,
      format: key.format as PollyOutputFormat,
      fileName,
      filePath,
      createdAt,
    };
  }

  private toEntry(row: CacheRow): CacheEntry {
    return {
      id: row.id,
      voice: row.voice as PollyVoice,
      textNormalized: row.text_normalized,
      textOriginal: row.text_original,
      format: row.format as PollyOutputFormat,
      fileName: row.file_name,
      filePath: path.join(this.audioDir, row.file_name),
      createdAt: row.created_at,
    };
  }

  private static normalize(text: string): string {
    return text.trim().toLowerCase();
  }

  private static fileNameFor(voice: string, normalized: string, format: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${voice}::${format}::${normalized}`)
      .digest('hex')
      .slice(0, 32);
    const ext = format === 'mp3' ? 'mp3' : format === 'ogg_vorbis' ? 'ogg' : 'pcm';
    return `${hash}.${ext}`;
  }
}
