import { PollyClient, SynthesizeSpeechCommand, Engine } from '@aws-sdk/client-polly';
import { Readable } from 'node:stream';
import { inject, injectable } from 'tsyringe';
import { PollyLanguage, PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';
import { Config } from './Config';
import { AudioCacheService } from './AudioCacheService';

export interface SynthesizeOptions {
  text: string;
  voice?: PollyVoice;
  language?: PollyLanguage;
  format?: PollyOutputFormat;
  engine?: Engine;
}

export interface SynthesizeResult {
  filePath: string;
  cached: boolean;
}

@injectable()
export class PollyService {
  private readonly client: PollyClient;

  constructor(
    @inject(Config) private readonly config: Config,
    @inject(AudioCacheService) private readonly cache: AudioCacheService,
  ) {
    this.client = new PollyClient({
      region: this.config.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.config.get<string>('aws.accessKeyId'),
        secretAccessKey: this.config.get<string>('aws.secretAccessKey'),
      },
    });
  }

  async synthesizeToFile(options: SynthesizeOptions): Promise<SynthesizeResult> {
    const voice = options.voice ?? this.config.get<PollyVoice>('polly.defaultVoice');
    const format = options.format ?? this.config.get<PollyOutputFormat>('polly.outputFormat');
    const language = options.language ?? this.config.get<PollyLanguage>('polly.defaultLanguage');

    const cacheKey = { voice, text: options.text, format };
    const hit = this.cache.find(cacheKey);
    if (hit) {
      return { filePath: hit.filePath, cached: true };
    }

    const command = new SynthesizeSpeechCommand({
      Text: options.text,
      VoiceId: voice,
      LanguageCode: language,
      OutputFormat: format,
      Engine: options.engine ?? 'standard',
    });

    const response = await this.client.send(command);
    if (!response.AudioStream) {
      throw new Error('Polly returned no audio stream');
    }

    const buffer = await PollyService.streamToBuffer(response.AudioStream as Readable);
    const entry = this.cache.save(cacheKey, buffer);
    return { filePath: entry.filePath, cached: false };
  }

  private static async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
