import { singleton } from 'tsyringe';
import { AppConfig } from '../models/BotConfig';
import { appConfig } from '../config';

@singleton()
export class Config {
  private readonly source: AppConfig;

  constructor() {
    this.source = appConfig;
  }

  get<T = unknown>(path: string): T {
    const value = this.resolve(path);
    if (value === undefined) {
      throw new Error(`Config key not found: ${path}`);
    }
    return value as T;
  }

  getOrDefault<T>(path: string, fallback: T): T {
    const value = this.resolve(path);
    return value === undefined ? fallback : (value as T);
  }

  has(path: string): boolean {
    return this.resolve(path) !== undefined;
  }

  raw(): AppConfig {
    return this.source;
  }

  private resolve(path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>((acc, segment) => {
        if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[segment];
        }
        return undefined;
      }, this.source);
  }
}
