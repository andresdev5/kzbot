import { AppConfig } from '../models/BotConfig';
import { botConfig } from './bot.config';
import { awsConfig, pollyConfig } from './aws.config';
import { cacheConfig } from './cache.config';
import { loggingConfig } from './logging.config';

export const appConfig: AppConfig = {
  bot: botConfig,
  aws: awsConfig,
  polly: pollyConfig,
  cache: cacheConfig,
  logging: loggingConfig,
};
