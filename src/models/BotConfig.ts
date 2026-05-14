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
  maxTextLength: number;
}

export interface CacheSection {
  enabled: boolean;
  audioDir: string;
  dbPath: string;
}

export type FishAudioModel = 's1' | 's2-pro';
export type FishAudioFormat = 'mp3' | 'wav' | 'pcm' | 'opus';

export interface FishAudioSection {
  apiKey: string;
  model: FishAudioModel;
  format: FishAudioFormat;
  maxTextLength: number;
  baseUrl: string;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'ERROR';

export interface LoggingSection {
  level: LogLevel;
}

export interface AppConfig {
  bot: BotSection;
  aws: AwsSection;
  polly: PollySection;
  cache: CacheSection;
  logging: LoggingSection;
  fish: FishAudioSection;
}
