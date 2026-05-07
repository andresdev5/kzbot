import { AwsSection, PollySection } from '../models/BotConfig';
import { PollyLanguage, PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';

export const awsConfig: AwsSection = {
  region: process.env.AWS_REGION ?? 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
};

export const pollyConfig: PollySection = {
  defaultVoice: (process.env.POLLY_DEFAULT_VOICE as PollyVoice) ?? PollyVoice.Joanna,
  defaultLanguage: (process.env.POLLY_DEFAULT_LANGUAGE as PollyLanguage) ?? PollyLanguage.EnglishUS,
  outputFormat: (process.env.POLLY_OUTPUT_FORMAT as PollyOutputFormat) ?? PollyOutputFormat.Mp3,
};
