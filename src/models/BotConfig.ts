import { PollyLanguage, PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';

export interface BotSection {
  token: string;
  clientId: string;
  prefix: string;
  ownerIds: string[];
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

export interface AppConfig {
  bot: BotSection;
  aws: AwsSection;
  polly: PollySection;
}
