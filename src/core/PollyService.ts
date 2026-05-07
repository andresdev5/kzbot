import { PollyClient, SynthesizeSpeechCommand, Engine } from '@aws-sdk/client-polly';
import { Readable } from 'node:stream';
import { inject, injectable } from 'tsyringe';
import { PollyLanguage, PollyOutputFormat, PollyVoice } from '../enums/PollyVoice';
import { Config } from './Config';

export interface SynthesizeOptions {
  text: string;
  voice?: PollyVoice;
  language?: PollyLanguage;
  format?: PollyOutputFormat;
  engine?: Engine;
}

@injectable()
export class PollyService {
  private readonly client: PollyClient;

  constructor(@inject(Config) private readonly config: Config) {
    this.client = new PollyClient({
      region: this.config.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.config.get<string>('aws.accessKeyId'),
        secretAccessKey: this.config.get<string>('aws.secretAccessKey'),
      },
    });
  }

  async synthesize(options: SynthesizeOptions): Promise<Readable> {
    const command = new SynthesizeSpeechCommand({
      Text: options.text,
      VoiceId: options.voice ?? this.config.get<PollyVoice>('polly.defaultVoice'),
      LanguageCode: options.language ?? this.config.get<PollyLanguage>('polly.defaultLanguage'),
      OutputFormat: options.format ?? this.config.get<PollyOutputFormat>('polly.outputFormat'),
      Engine: options.engine ?? 'standard',
    });

    const response = await this.client.send(command);
    if (!response.AudioStream) {
      throw new Error('Polly returned no audio stream');
    }
    return response.AudioStream as Readable;
  }
}
