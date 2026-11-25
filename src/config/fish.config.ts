import { FishAudioFormat, FishAudioModel, FishAudioSection } from '../models/BotConfig';

const DEFAULT_MAX_TEXT_LENGTH = 1000;
const DEFAULT_MODEL: FishAudioModel = 'drama-3';
const DEFAULT_FALLBACK_MODEL: FishAudioModel = 's2.1-pro';
const VALID_MODELS: FishAudioModel[] = [
  's1',
  's2-pro',
  's2.1-pro',
  's2.1-pro-free',
  'drama-3',
  's3-pro',
];
const VALID_FORMATS: FishAudioFormat[] = ['mp3', 'wav', 'pcm', 'opus'];

function parseMaxTextLength(raw: string | undefined): number {
  if (!raw) return DEFAULT_MAX_TEXT_LENGTH;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TEXT_LENGTH;
  return parsed;
}

export function isFishAudioModel(raw: string): raw is FishAudioModel {
  return (VALID_MODELS as string[]).includes(raw);
}

function parseModel(raw: string | undefined): FishAudioModel {
  const value = raw?.trim();
  return value && isFishAudioModel(value) ? value : DEFAULT_MODEL;
}

function parseFallbackModel(raw: string | undefined, primary: FishAudioModel): FishAudioModel | null {
  const value = raw?.trim();
  if (value === 'none') return null;
  const fallback = value && isFishAudioModel(value) ? value : DEFAULT_FALLBACK_MODEL;
  return fallback === primary ? null : fallback;
}

function parseFormat(raw: string | undefined): FishAudioFormat {
  if (!raw) return 'mp3';
  return (VALID_FORMATS as string[]).includes(raw) ? (raw as FishAudioFormat) : 'mp3';
}

const model = parseModel(process.env.FISH_AUDIO_MODEL);

export const fishConfig: FishAudioSection = {
  apiKey: process.env.FISH_AUDIO_API_KEY ?? '',
  model,
  fallbackModel: parseFallbackModel(process.env.FISH_AUDIO_FALLBACK_MODEL, model),
  format: parseFormat(process.env.FISH_AUDIO_FORMAT),
  maxTextLength: parseMaxTextLength(process.env.FISH_AUDIO_MAX_TEXT_LENGTH),
  baseUrl: process.env.FISH_AUDIO_BASE_URL ?? 'https://api.fish.audio',
};
