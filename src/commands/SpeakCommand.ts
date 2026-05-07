import { ChannelType } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { Config } from '../core/Config';
import { PollyService } from '../core/PollyService';
import { VoiceManager } from '../core/VoiceManager';
import { findVoice } from '../models/VoiceCatalog';
import { PollyVoice } from '../enums/PollyVoice';

interface ParsedSpeak {
  voice?: PollyVoice;
  voiceToken?: string;
  text: string;
}

@injectable()
export class SpeakCommand extends BaseCommand {
  readonly name = 'speak';
  readonly aliases = ['say', 'tts'];
  readonly description = 'Speaks text in your voice channel using AWS Polly';
  readonly category = CommandCategory.Voice;
  readonly usage = 'speak [:VoiceName] <text>';
  readonly slash: SlashCommandConfig;

  private readonly maxTextLength: number;

  constructor(
    @inject(Config) config: Config,
    @inject(PollyService) private readonly polly: PollyService,
    @inject(VoiceManager) private readonly voice: VoiceManager,
  ) {
    super();
    this.maxTextLength = config.get<number>('polly.maxTextLength');
    this.slash = {
      slashAliases: ['tts', 'say'],
      options: [
        {
          type: 'string',
          name: 'text',
          description: `Text to speak (max ${this.maxTextLength} chars; longer is truncated)`,
          required: true,
          maxLength: this.maxTextLength,
        },
        {
          type: 'string',
          name: 'voice',
          description: 'Polly voice ID (e.g. Ricardo). Omit to use the default.',
          required: false,
        },
      ],
    };
  }

  async execute(ctx: CommandContext): Promise<void> {
    const parsed = this.readArgs(ctx);
    if ('error' in parsed) {
      await ctx.reply(parsed.error);
      return;
    }

    const member = await ctx.getMember();
    const channel = member?.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply('You must be in a voice channel.');
      return;
    }

    const wasTruncated = parsed.text.length > this.maxTextLength;
    const finalText = wasTruncated ? parsed.text.slice(0, this.maxTextLength) : parsed.text;

    await ctx.defer();

    const result = await this.polly.synthesizeToFile({
      text: finalText,
      voice: parsed.voice,
    });
    console.debug(
      `[polly] ${result.cached ? 'cache hit' : 'cache miss'} (${result.voice}): ${result.filePath}`,
    );

    try {
      await this.voice.play(channel, result.filePath);
      const note = wasTruncated
        ? ` (truncated to ${this.maxTextLength} chars)`
        : '';
      await ctx.reply(`Speaking with \`${result.voice}\`${note}.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Voice playback failed: ${reason}`);
      throw err;
    }
  }

  private readArgs(ctx: CommandContext): ParsedSpeak | { error: string } {
    if (ctx.source === 'interaction') {
      const interaction = ctx.interaction!;
      const text = interaction.options.getString('text', true).trim();
      const voiceArg = interaction.options.getString('voice')?.trim();
      if (!text) return { error: 'Provide some text to speak.' };

      if (voiceArg) {
        const found = findVoice(voiceArg);
        if (!found) {
          return { error: `Unknown voice \`${voiceArg}\`. Use \`/voices\` to see the list.` };
        }
        return { voice: found.id, text };
      }
      return { text };
    }

    if (!ctx.rawArgs) return { error: 'Provide some text to speak.' };
    const parsed = SpeakCommand.parseRawArgs(ctx.rawArgs);
    if (parsed.voiceToken && !parsed.voice) {
      return {
        error: `Unknown voice \`${parsed.voiceToken}\`. Use \`${ctx.prefix}voices\` to see the list.`,
      };
    }
    if (!parsed.text) {
      return { error: 'Provide some text to speak after the voice.' };
    }
    return parsed;
  }

  private static parseRawArgs(raw: string): ParsedSpeak {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(':')) return { text: trimmed };
    const rest = trimmed.slice(1);
    const spaceIdx = rest.search(/\s/);
    const token = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
    const text = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
    const found = findVoice(token);
    return { voice: found?.id, voiceToken: token, text };
  }
}
