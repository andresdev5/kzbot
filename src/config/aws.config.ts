import { AwsSection, PollySection } from '../models/BotConfig';
import { PollyLanguage, PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';

const DEFAULT_MAX_TEXT_LENGTH = 1000;

function parseMaxTextLength(raw: string | undefined): number {
  if (!raw) return DEFAULT_MAX_TEXT_LENGTH;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TEXT_LENGTH;
  return parsed;
}

export const awsConfig: AwsSection = {
  region: process.env.AWS_REGION ?? 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
};

export const pollyConfig: PollySection = {
  defaultVoice: (process.env.POLLY_DEFAULT_VOICE as PollyVoice) ?? PollyVoice.Joanna,
  defaultLanguage: (process.env.POLLY_DEFAULT_LANGUAGE as PollyLanguage) ?? PollyLanguage.EnglishUS,
  outputFormat: (process.env.POLLY_OUTPUT_FORMAT as PollyOutputFormat) ?? PollyOutputFormat.Mp3,
  maxTextLength: parseMaxTextLength(process.env.POLLY_MAX_TEXT_LENGTH),
};
