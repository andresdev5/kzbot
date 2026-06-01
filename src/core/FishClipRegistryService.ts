import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { inject, singleton } from 'tsyringe';
import { DatabaseProvider } from './DatabaseProvider';

/** One spoken fragment of a clip. An empty referenceId means the model default voice. */
export interface FishClipSegment {
  referenceId: string;
  text: string;
}

export interface FishClip {
  uid: number;
  segments: FishClipSegment[];
  createdAt: string;
}

export interface FishClipAlias {
  userId: string;
  alias: string;
  aliasNormalized: string;
  clipUid: number;
  createdAt: string;
}

export const CLIP_ALIAS_REGEX = /^[a-zA-Z0-9_-]+$/;

export class ClipAliasTakenError extends Error {
  constructor(public readonly alias: string, public readonly existingClipUid: number) {
    super(`Clip alias "${alias}" is already taken by uid ${existingClipUid}`);
    this.name = 'ClipAliasTakenError';
  }
}

export class InvalidClipAliasError extends Error {
  constructor(public readonly alias: string) {
    super(`Clip alias "${alias}" is invalid (allowed: a-zA-Z0-9_-, no spaces).`);
    this.name = 'InvalidClipAliasError';
  }
}

export class ClipNotFoundError extends Error {
  constructor(public readonly uid: number) {
    super(`No clip found with uid ${uid}`);
    this.name = 'ClipNotFoundError';
  }
}

interface ClipRow {
  uid: number;
  segments: string;
  created_at: string;
}

interface ClipAliasRow {
  user_id: string;
  alias_normalized: string;
  alias_original: string;
  clip_uid: number;
  created_at: string;
}

@singleton()
export class FishClipRegistryService {
  private readonly insertClipStmt: Database.Statement<[string, string, string]>;
  private readonly findClipByHashStmt: Database.Statement<[string], ClipRow>;
  private readonly getClipStmt: Database.Statement<[number], ClipRow>;
  private readonly insertAliasStmt: Database.Statement<[string, string, string, number, string]>;
  private readonly findAliasStmt: Database.Statement<[string, string], ClipAliasRow>;
  private readonly listAliasesStmt: Database.Statement<[string], ClipAliasRow>;

  constructor(@inject(DatabaseProvider) database: DatabaseProvider) {
    database.db.exec(`
      CREATE TABLE IF NOT EXISTS fish_clips (
        uid INTEGER PRIMARY KEY AUTOINCREMENT,
        segments_hash TEXT NOT NULL UNIQUE,
        segments TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fish_clip_aliases (
        user_id TEXT NOT NULL,
        alias_normalized TEXT NOT NULL,
        alias_original TEXT NOT NULL,
        clip_uid INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, alias_normalized)
      );
      CREATE INDEX IF NOT EXISTS idx_fish_clip_aliases_uid ON fish_clip_aliases(clip_uid);
    `);

    this.insertClipStmt = database.db.prepare(
      `INSERT INTO fish_clips (segments_hash, segments, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(segments_hash) DO NOTHING`,
    );
    this.findClipByHashStmt = database.db.prepare(
      'SELECT * FROM fish_clips WHERE segments_hash = ?',
    );
    this.getClipStmt = database.db.prepare('SELECT * FROM fish_clips WHERE uid = ?');
    this.insertAliasStmt = database.db.prepare(
      `INSERT INTO fish_clip_aliases (user_id, alias_normalized, alias_original, clip_uid, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.findAliasStmt = database.db.prepare(
      'SELECT * FROM fish_clip_aliases WHERE user_id = ? AND alias_normalized = ?',
    );
    this.listAliasesStmt = database.db.prepare(
      'SELECT * FROM fish_clip_aliases WHERE user_id = ? ORDER BY alias_normalized ASC',
    );
  }

  /** Persist a played clip (deduped by content) and return its uid. */
  recordClip(segments: FishClipSegment[]): FishClip {
    const json = JSON.stringify(segments);
    const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
    const createdAt = new Date().toISOString();
    this.insertClipStmt.run(hash, json, createdAt);
    const row = this.findClipByHashStmt.get(hash)!;
    return FishClipRegistryService.rowToClip(row);
  }

  getClip(uid: number): FishClip | null {
    const row = this.getClipStmt.get(uid);
    return row ? FishClipRegistryService.rowToClip(row) : null;
  }

  setAlias(userId: string, alias: string, clipUid: number): FishClipAlias {
    const trimmed = alias.trim();
    if (!CLIP_ALIAS_REGEX.test(trimmed)) throw new InvalidClipAliasError(alias);
    if (!this.getClip(clipUid)) throw new ClipNotFoundError(clipUid);

    const normalized = trimmed.toLowerCase();
    const existing = this.findAliasStmt.get(userId, normalized);
    if (existing) {
      if (existing.clip_uid === clipUid) {
        return FishClipRegistryService.rowToAlias(existing);
      }
      throw new ClipAliasTakenError(existing.alias_original, existing.clip_uid);
    }
    const createdAt = new Date().toISOString();
    this.insertAliasStmt.run(userId, normalized, trimmed, clipUid, createdAt);
    return { userId, alias: trimmed, aliasNormalized: normalized, clipUid, createdAt };
  }

  getAlias(userId: string, alias: string): FishClipAlias | null {
    const row = this.findAliasStmt.get(userId, alias.trim().toLowerCase());
    return row ? FishClipRegistryService.rowToAlias(row) : null;
  }

  /** Resolve a `{token}` to a clip for a user: numeric token is a uid, otherwise their clip alias. */
  resolveClip(userId: string, token: string): FishClip | null {
    const trimmed = token.trim();
    if (/^\d+$/.test(trimmed)) {
      return this.getClip(Number(trimmed));
    }
    const alias = this.getAlias(userId, trimmed);
    return alias ? this.getClip(alias.clipUid) : null;
  }

  listAliases(userId: string): FishClipAlias[] {
    return this.listAliasesStmt.all(userId).map(FishClipRegistryService.rowToAlias);
  }

  private static rowToClip(row: ClipRow): FishClip {
    let segments: FishClipSegment[] = [];
    try {
      const parsed = JSON.parse(row.segments);
      if (Array.isArray(parsed)) segments = parsed as FishClipSegment[];
    } catch {
      segments = [];
    }
    return { uid: row.uid, segments, createdAt: row.created_at };
  }

  private static rowToAlias(row: ClipAliasRow): FishClipAlias {
    return {
      userId: row.user_id,
      alias: row.alias_original,
      aliasNormalized: row.alias_normalized,
      clipUid: row.clip_uid,
      createdAt: row.created_at,
    };
  }
}
