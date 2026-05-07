import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { inject, injectable } from 'tsyringe';
import { Config } from './Config';

@injectable()
export class DatabaseProvider {
  readonly db: Database.Database;

  constructor(@inject(Config) config: Config) {
    const dbPath = config.get<string>('cache.dbPath');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }
}
