import type Database from 'better-sqlite3';
import { inject, singleton } from 'tsyringe';
import { DatabaseProvider } from './DatabaseProvider';
import { FishVoice } from '../models/FishVoice';

interface VoiceRow {
  id: string;
  title: string;
  author_id: string;
  author_nickname: string;
  languages: string;
  tags: string;
  description: string;
  visibility: string;
  task_count: number;
  recorded_at: string;
}

interface SearchRow {
  result_ids: string;
  total: number;
  cached_at: string;
}

interface AliasRow {
  alias_normalized: string;
  alias_original: string;
  reference_id: string;
  created_at: string;
}

export interface FishAlias {
  alias: string;
  aliasNormalized: string;
  referenceId: string;
  createdAt: string;
}

export const ALIAS_REGEX = /^[a-zA-Z0-9_-]+$/;

export class AliasTakenError extends Error {
  constructor(public readonly alias: string, public readonly existingReferenceId: string) {
    super(`Alias "${alias}" is already taken by reference_id ${existingReferenceId}`);
    this.name = 'AliasTakenError';
  }
}

export class InvalidAliasError extends Error {
  constructor(public readonly alias: string) {
    super(`Alias "${alias}" is invalid (allowed: a-zA-Z0-9_-, no spaces).`);
    this.name = 'InvalidAliasError';
  }
}

@singleton()
export class FishVoiceRegistryService {
  private readonly upsertVoiceStmt: Database.Statement<
    [string, string, string, string, string, string, string, string, number, string]
  >;
  private readonly getVoiceStmt: Database.Statement<[string], VoiceRow>;
  private readonly findSearchStmt: Database.Statement<[string, string], SearchRow>;
  private readonly upsertSearchStmt: Database.Statement<[string, string, string, number, string]>;
  private readonly findAliasStmt: Database.Statement<[string], AliasRow>;
  private readonly insertAliasStmt: Database.Statement<[string, string, string, string]>;
  private readonly listAliasesStmt: Database.Statement<[], AliasRow>;
  private readonly findAliasesByReferenceStmt: Database.Statement<[string], AliasRow>;

  constructor(@inject(DatabaseProvider) database: DatabaseProvider) {
    database.db.exec(`
      CREATE TABLE IF NOT EXISTS fish_voices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_nickname TEXT NOT NULL,
        languages TEXT NOT NULL,
        tags TEXT NOT NULL,
        description TEXT NOT NULL,
        visibility TEXT NOT NULL,
        task_count INTEGER NOT NULL DEFAULT 0,
        recorded_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fish_voice_searches (
        query_normalized TEXT NOT NULL,
        language TEXT NOT NULL,
        result_ids TEXT NOT NULL,
        total INTEGER NOT NULL,
        cached_at TEXT NOT NULL,
        PRIMARY KEY (query_normalized, language)
      );

      CREATE TABLE IF NOT EXISTS fish_aliases (
        alias_normalized TEXT PRIMARY KEY,
        alias_original TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fish_aliases_ref ON fish_aliases(reference_id);
    `);

    this.upsertVoiceStmt = database.db.prepare(
      `INSERT INTO fish_voices
        (id, title, author_id, author_nickname, languages, tags, description, visibility, task_count, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         author_id = excluded.author_id,
         author_nickname = excluded.author_nickname,
         languages = excluded.languages,
         tags = excluded.tags,
         description = excluded.description,
         visibility = excluded.visibility,
         task_count = excluded.task_count,
         recorded_at = excluded.recorded_at`,
    );

    this.getVoiceStmt = database.db.prepare('SELECT * FROM fish_voices WHERE id = ?');

    this.findSearchStmt = database.db.prepare(
      `SELECT result_ids, total, cached_at FROM fish_voice_searches
       WHERE query_normalized = ? AND language = ?`,
    );

    this.upsertSearchStmt = database.db.prepare(
      `INSERT INTO fish_voice_searches (query_normalized, language, result_ids, total, cached_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(query_normalized, language) DO UPDATE SET
         result_ids = excluded.result_ids,
         total = excluded.total,
         cached_at = excluded.cached_at`,
    );

    this.findAliasStmt = database.db.prepare(
      'SELECT * FROM fish_aliases WHERE alias_normalized = ?',
    );
    this.insertAliasStmt = database.db.prepare(
      `INSERT INTO fish_aliases (alias_normalized, alias_original, reference_id, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    this.listAliasesStmt = database.db.prepare(
      'SELECT * FROM fish_aliases ORDER BY alias_normalized ASC',
    );
    this.findAliasesByReferenceStmt = database.db.prepare(
      'SELECT * FROM fish_aliases WHERE reference_id = ? ORDER BY created_at ASC',
    );
  }

  recordVoice(voice: FishVoice): void {
    this.upsertVoiceStmt.run(
      voice.id,
      voice.title,
      voice.authorId,
      voice.authorNickname,
      JSON.stringify(voice.languages),
      JSON.stringify(voice.tags),
      voice.description,
      voice.visibility,
      voice.taskCount,
      new Date().toISOString(),
    );
  }

  recordVoices(voices: FishVoice[]): void {
    for (const v of voices) this.recordVoice(v);
  }

  getVoice(id: string): FishVoice | null {
    const row = this.getVoiceStmt.get(id);
    return row ? FishVoiceRegistryService.rowToVoice(row) : null;
  }

  findSearch(query: string, language: string): { voiceIds: string[]; total: number } | null {
    const normalizedQuery = FishVoiceRegistryService.normalize(query);
    const row = this.findSearchStmt.get(normalizedQuery, language);
    if (!row) return null;
    try {
      const ids = JSON.parse(row.result_ids) as string[];
      return { voiceIds: ids, total: row.total };
    } catch {
      return null;
    }
  }

  saveSearch(query: string, language: string, voices: FishVoice[], total: number): void {
    const normalizedQuery = FishVoiceRegistryService.normalize(query);
    this.recordVoices(voices);
    this.upsertSearchStmt.run(
      normalizedQuery,
      language,
      JSON.stringify(voices.map((v) => v.id)),
      total,
      new Date().toISOString(),
    );
  }

  hydrateVoices(ids: string[]): FishVoice[] {
    const out: FishVoice[] = [];
    for (const id of ids) {
      const v = this.getVoice(id);
      if (v) out.push(v);
    }
    return out;
  }

  setAlias(alias: string, referenceId: string): FishAlias {
    const trimmed = alias.trim();
    if (!ALIAS_REGEX.test(trimmed)) throw new InvalidAliasError(alias);
    const normalized = trimmed.toLowerCase();
    const existing = this.findAliasStmt.get(normalized);
    if (existing) {
      if (existing.reference_id === referenceId) {
        return FishVoiceRegistryService.rowToAlias(existing);
      }
      throw new AliasTakenError(existing.alias_original, existing.reference_id);
    }
    const createdAt = new Date().toISOString();
    this.insertAliasStmt.run(normalized, trimmed, referenceId, createdAt);
    return {
      alias: trimmed,
      aliasNormalized: normalized,
      referenceId,
      createdAt,
    };
  }

  getAlias(alias: string): FishAlias | null {
    const normalized = alias.trim().toLowerCase();
    const row = this.findAliasStmt.get(normalized);
    return row ? FishVoiceRegistryService.rowToAlias(row) : null;
  }

  getReferenceIdByAlias(alias: string): string | null {
    return this.getAlias(alias)?.referenceId ?? null;
  }

  listAliases(): FishAlias[] {
    return this.listAliasesStmt.all().map(FishVoiceRegistryService.rowToAlias);
  }

  aliasesFor(referenceId: string): FishAlias[] {
    return this.findAliasesByReferenceStmt
      .all(referenceId)
      .map(FishVoiceRegistryService.rowToAlias);
  }

  private static rowToAlias(row: AliasRow): FishAlias {
    return {
      alias: row.alias_original,
      aliasNormalized: row.alias_normalized,
      referenceId: row.reference_id,
      createdAt: row.created_at,
    };
  }

  private static normalize(query: string): string {
    return query.trim().toLowerCase();
  }

  private static rowToVoice(row: VoiceRow): FishVoice {
    return {
      id: row.id,
      title: row.title,
      authorId: row.author_id,
      authorNickname: row.author_nickname,
      languages: FishVoiceRegistryService.parseJsonArray(row.languages),
      tags: FishVoiceRegistryService.parseJsonArray(row.tags),
      description: row.description,
      visibility: row.visibility,
      taskCount: row.task_count,
    };
  }

  private static parseJsonArray(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
}
