import path from 'node:path';
import { CacheSection } from '../models/BotConfig';

const baseDir = path.resolve(process.cwd(), process.env.CACHE_DIR ?? 'cache');

export const cacheConfig: CacheSection = {
  enabled: (process.env.CACHE_ENABLED ?? 'true').toLowerCase() !== 'false',
  audioDir: path.join(baseDir, 'audio'),
  dbPath: process.env.CACHE_DB_PATH
    ? path.resolve(process.cwd(), process.env.CACHE_DB_PATH)
    : path.join(baseDir, 'cache.db'),
};
