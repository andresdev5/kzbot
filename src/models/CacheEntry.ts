import { PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';

export interface CacheEntry {
  id: number;
  voice: PollyVoice;
  textNormalized: string;
  textOriginal: string;
  format: PollyOutputFormat;
  fileName: string;
  filePath: string;
  createdAt: string;
}

export interface CacheLookupKey {
  voice: PollyVoice;
  text: string;
  format: PollyOutputFormat;
}
