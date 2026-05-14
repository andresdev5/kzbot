import { inject, singleton } from 'tsyringe';
import { Config } from './Config';
import { Logger } from './Logger';
import { FishAudioCacheService } from './FishAudioCacheService';
import { FishVoiceRegistryService } from './FishVoiceRegistryService';
import { SettingsService, SETTING_FISH_DEFAULT_REFERENCE_ID } from './SettingsService';
import { FishVoice } from '../models/FishVoice';
import { FishAudioFormat, FishAudioModel } from '../models/BotConfig';

export interface FishSynthesizeOptions {
  text: string;
  referenceId?: string;
}

export interface FishSynthesizeResult {
  filePath: string;
  cached: boolean;
  referenceId: string;
  model: FishAudioModel;
}

interface RawAuthor {
  _id: string;
  nickname: string;
  avatar?: string;
}

interface RawModel {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  languages?: string[];
  visibility?: string;
  task_count?: number;
  author: RawAuthor;
}

interface RawSearchResponse {
  total: number;
  items: RawModel[];
  has_more?: boolean | null;
}

const REFERENCE_ID_REGEX = /^[a-f0-9]{32}$/i;

@singleton()
export class FishAudioService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: FishAudioModel;
  private readonly format: FishAudioFormat;
  private readonly maxTextLength: number;

  constructor(
    @inject(Config) config: Config,
    @inject(Logger) private readonly logger: Logger,
    @inject(FishAudioCacheService) private readonly cache: FishAudioCacheService,
    @inject(FishVoiceRegistryService) private readonly registry: FishVoiceRegistryService,
    @inject(SettingsService) private readonly settings: SettingsService,
  ) {
    this.apiKey = config.get<string>('fish.apiKey');
    this.baseUrl = config.get<string>('fish.baseUrl');
    this.model = config.get<FishAudioModel>('fish.model');
    this.format = config.get<FishAudioFormat>('fish.format');
    this.maxTextLength = config.get<number>('fish.maxTextLength');
  }

  static isReferenceId(value: string): boolean {
    return REFERENCE_ID_REGEX.test(value.trim());
  }

  getMaxTextLength(): number {
    return this.maxTextLength;
  }

  getDefaultReferenceId(): string | undefined {
    return this.settings.get(SETTING_FISH_DEFAULT_REFERENCE_ID);
  }

  setDefaultReferenceId(id: string): void {
    this.settings.set(SETTING_FISH_DEFAULT_REFERENCE_ID, id);
  }

  clearDefaultReferenceId(): void {
    this.settings.delete(SETTING_FISH_DEFAULT_REFERENCE_ID);
  }

  async searchVoices(
    query: string,
    language?: string,
    pageSize = 30,
  ): Promise<{ items: FishVoice[]; total: number; cached: boolean }> {
    const cacheLanguageKey = language ?? '';
    const cached = this.registry.findSearch(query, cacheLanguageKey);
    if (cached) {
      const hydrated = this.registry.hydrateVoices(cached.voiceIds);
      this.logger.debug(`[fish] search cache hit for "${query}" lang=${cacheLanguageKey || '<any>'}`);
      return { items: hydrated, total: cached.total, cached: true };
    }

    this.assertApiKey();
    const url = new URL('/model', this.baseUrl);
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('page_number', '1');
    if (query.trim()) url.searchParams.set('title', query.trim());
    if (language) url.searchParams.set('language', language);

    this.logger.debug(`[fish] GET ${url.toString()}`);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Fish Audio search failed (${response.status}): ${body.slice(0, 200)}`);
    }
    const json = (await response.json()) as RawSearchResponse;
    const items = (json.items ?? []).map(FishAudioService.normalizeVoice);
    this.registry.saveSearch(query, cacheLanguageKey, items, json.total ?? items.length);
    return { items, total: json.total ?? items.length, cached: false };
  }

  async getVoiceById(id: string): Promise<FishVoice | null> {
    const cached = this.registry.getVoice(id);
    if (cached) return cached;

    this.assertApiKey();
    const url = new URL(`/model/${encodeURIComponent(id)}`, this.baseUrl);
    this.logger.debug(`[fish] GET ${url.toString()}`);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Fish Audio voice lookup failed (${response.status}): ${body.slice(0, 200)}`);
    }
    const json = (await response.json()) as RawModel;
    const voice = FishAudioService.normalizeVoice(json);
    this.registry.recordVoice(voice);
    return voice;
  }

  async synthesizeToFile(options: FishSynthesizeOptions): Promise<FishSynthesizeResult> {
    const referenceId = options.referenceId ?? '';
    const cacheKey = {
      referenceId,
      text: options.text,
      model: this.model,
      format: this.format,
    };
    const hit = this.cache.find(cacheKey);
    if (hit) {
      return { filePath: hit.filePath, cached: true, referenceId, model: this.model };
    }

    this.assertApiKey();
    const body: Record<string, unknown> = {
      text: options.text,
      format: this.format,
    };
    if (referenceId) body.reference_id = referenceId;

    const url = new URL('/v1/tts', this.baseUrl);
    this.logger.debug(
      `[fish] POST ${url.toString()} reference_id=${referenceId || '<none>'} model=${this.model}`,
    );
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        model: this.model,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Fish Audio TTS failed (${response.status}): ${errBody.slice(0, 200)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const entry = this.cache.save(cacheKey, buffer);
    return { filePath: entry.filePath, cached: false, referenceId, model: this.model };
  }

  private assertApiKey(): void {
    if (!this.apiKey) {
      throw new Error('FISH_AUDIO_API_KEY is not configured.');
    }
  }

  private static normalizeVoice(raw: RawModel): FishVoice {
    return {
      id: raw._id,
      title: raw.title ?? '',
      authorId: raw.author?._id ?? '',
      authorNickname: raw.author?.nickname ?? '',
      languages: Array.isArray(raw.languages) ? raw.languages : [],
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      description: raw.description ?? '',
      visibility: raw.visibility ?? '',
      taskCount: typeof raw.task_count === 'number' ? raw.task_count : 0,
    };
  }
}
