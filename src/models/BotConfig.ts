import { PollyLanguage, PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';

export interface BotSection {
  token: string;
  clientId: string;
  prefix: string;
  ownerIds: string[];
  aliasPrefixes: Record<string, string>;
  devGuildId: string;
}

export interface AwsSection {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface PollySection {
  defaultVoice: PollyVoice;
  defaultLanguage: PollyLanguage;
  outputFormat: PollyOutputFormat;
}

export interface CacheSection {
  enabled: boolean;
  audioDir: string;
  dbPath: string;
}

export interface AppConfig {
  bot: BotSection;
  aws: AwsSection;
  polly: PollySection;
  cache: CacheSection;
}
