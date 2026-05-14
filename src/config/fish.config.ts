import { FishAudioFormat, FishAudioModel, FishAudioSection } from '../models/BotConfig';

const DEFAULT_MAX_TEXT_LENGTH = 1000;
const VALID_MODELS: FishAudioModel[] = ['s1', 's2-pro'];
const VALID_FORMATS: FishAudioFormat[] = ['mp3', 'wav', 'pcm', 'opus'];

function parseMaxTextLength(raw: string | undefined): number {
  if (!raw) return DEFAULT_MAX_TEXT_LENGTH;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TEXT_LENGTH;
  return parsed;
}

function parseModel(raw: string | undefined): FishAudioModel {
  if (!raw) return 's2-pro';
  return (VALID_MODELS as string[]).includes(raw) ? (raw as FishAudioModel) : 's2-pro';
}

function parseFormat(raw: string | undefined): FishAudioFormat {
  if (!raw) return 'mp3';
  return (VALID_FORMATS as string[]).includes(raw) ? (raw as FishAudioFormat) : 'mp3';
}

export const fishConfig: FishAudioSection = {
  apiKey: process.env.FISH_AUDIO_API_KEY ?? '',
  model: parseModel(process.env.FISH_AUDIO_MODEL),
  format: parseFormat(process.env.FISH_AUDIO_FORMAT),
  maxTextLength: parseMaxTextLength(process.env.FISH_AUDIO_MAX_TEXT_LENGTH),
  baseUrl: process.env.FISH_AUDIO_BASE_URL ?? 'https://api.fish.audio',
};
