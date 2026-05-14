import { inject, singleton } from 'tsyringe';
import { LogLevel } from '../models/BotConfig';
import { Config } from './Config';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  ERROR: 2,
};

@singleton()
export class Logger {
  private readonly minPriority: number;
  private readonly level: LogLevel;

  constructor(@inject(Config) config: Config) {
    this.level = config.get<LogLevel>('logging.level');
    this.minPriority = LEVEL_PRIORITY[this.level];
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(...args: unknown[]): void {
    if (this.minPriority <= LEVEL_PRIORITY.DEBUG) console.log('[DEBUG]', ...args);
  }

  info(...args: unknown[]): void {
    if (this.minPriority <= LEVEL_PRIORITY.INFO) console.log('[INFO]', ...args);
  }

  error(...args: unknown[]): void {
    if (this.minPriority <= LEVEL_PRIORITY.ERROR) console.error('[ERROR]', ...args);
  }
}
