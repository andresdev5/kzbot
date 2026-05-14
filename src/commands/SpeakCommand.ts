import { ChannelType } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { Config } from '../core/Config';
import { Logger } from '../core/Logger';
import { PollyService } from '../core/PollyService';
import { VoiceManager } from '../core/VoiceManager';
import { findVoice } from '../models/VoiceCatalog';
import { PollyVoice } from '../enums/PollyVoice';

interface SpeakSegment {
  voice?: PollyVoice;
  text: string;
}

interface ParsedSpeak {
  segments: SpeakSegment[];
  defaultVoice?: PollyVoice;
}

@injectable()
export class SpeakCommand extends BaseCommand {
  readonly name = 'speak';
  readonly aliases = ['say', 'tts'];
  readonly description = 'Speaks text in your voice channel using AWS Polly';
  readonly category = CommandCategory.Voice;
  readonly usage = 'speak [:VoiceName] <text> — supports <voice:fragment> for multi-voice';
  readonly slash: SlashCommandConfig;
  readonly runOnEdit = true;

  private readonly maxTextLength: number;

  constructor(
    @inject(Config) config: Config,
    @inject(PollyService) private readonly polly: PollyService,
    @inject(VoiceManager) private readonly voice: VoiceManager,
    @inject(Logger) private readonly logger: Logger,
  ) {
    super();
    this.maxTextLength = config.get<number>('polly.maxTextLength');
    this.slash = {
      slashAliases: ['tts', 'say'],
      options: [
        {
          type: 'string',
          name: 'text',
          description: `Text to speak (max ${this.maxTextLength} chars; supports <voice:fragment>)`,
          required: true,
          maxLength: this.maxTextLength,
        },
        {
          type: 'string',
          name: 'voice',
          description: 'Default Polly voice ID for non-tagged text (e.g. Ricardo).',
          required: false,
        },
      ],
    };
  }

  async execute(ctx: CommandContext): Promise<void> {
    this.logger.debug(`[speak] start source=${ctx.source} rawArgs=${JSON.stringify(ctx.rawArgs)}`);
    const parsed = this.readArgs(ctx);
    if ('error' in parsed) {
      this.logger.debug(`[speak] readArgs error: ${parsed.error}`);
      await ctx.reply(parsed.error);
      return;
    }
    this.logger.debug(
      `[speak] parsed segments=${JSON.stringify(
        parsed.segments.map((s) => ({ v: s.voice ?? '<default>', len: s.text.length })),
      )} defaultVoice=${parsed.defaultVoice ?? '<service-default>'}`,
    );

    const member = await ctx.getMember();
    const channel = member?.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply('You must be in a voice channel.');
      return;
    }

    const totalLen = parsed.segments.reduce((n, s) => n + s.text.length, 0);
    const wasTruncated = totalLen > this.maxTextLength;
    const finalSegments = wasTruncated
      ? SpeakCommand.truncateSegments(parsed.segments, this.maxTextLength)
      : parsed.segments;

    if (finalSegments.length === 0) {
      await ctx.reply('Provide some text to speak.');
      return;
    }

    await ctx.defer();

    const results = await Promise.all(
      finalSegments.map((s) =>
        this.polly.synthesizeToFile({
          text: s.text,
          voice: s.voice ?? parsed.defaultVoice,
        }),
      ),
    );
    for (const r of results) {
      this.logger.debug(
        `[polly] ${r.cached ? 'cache hit' : 'cache miss'} (${r.voice}): ${r.filePath}`,
      );
    }

    const filePaths = results.map((r) => r.filePath);
    const voicesUsed = SpeakCommand.uniquePreserveOrder(results.map((r) => r.voice));

    try {
      this.logger.debug(`[speak] playing ${filePaths.length} segment(s) in #${channel.name}`);
      if (filePaths.length === 1) {
        await this.voice.play(channel, filePaths[0]);
      } else {
        await this.voice.playSequence(channel, filePaths);
      }
      const note = wasTruncated ? ` (truncated to ${this.maxTextLength} chars)` : '';
      const voiceList =
        voicesUsed.length === 1 ? `\`${voicesUsed[0]}\`` : voicesUsed.map((v) => `\`${v}\``).join(', ');
      await ctx.reply(`Speaking with ${voiceList}${note}.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`[speak] playback failed:`, err);
      await ctx.reply(`Voice playback failed: ${reason}`);
      throw err;
    }
  }

  private readArgs(ctx: CommandContext): ParsedSpeak | { error: string } {
    if (ctx.source === 'interaction') {
      const interaction = ctx.interaction!;
      const rawText = interaction.options.getString('text', true).trim();
      const voiceArg = interaction.options.getString('voice')?.trim();
      if (!rawText) return { error: 'Provide some text to speak.' };

      let defaultVoice: PollyVoice | undefined;
      if (voiceArg) {
        const found = findVoice(voiceArg);
        if (!found) {
          return { error: `Unknown voice \`${voiceArg}\`. Use \`/voices\` to see the list.` };
        }
        defaultVoice = found.id;
      }

      const segResult = SpeakCommand.parseSegments(rawText);
      if ('error' in segResult) return segResult;
      if (segResult.segments.length === 0) {
        return { error: 'Provide some text to speak.' };
      }
      return { segments: segResult.segments, defaultVoice };
    }

    if (!ctx.rawArgs) return { error: 'Provide some text to speak.' };

    const peeled = SpeakCommand.peelDefaultVoice(ctx.rawArgs);
    if (peeled.voiceToken && !peeled.defaultVoice) {
      return {
        error: `Unknown voice \`${peeled.voiceToken}\`. Use \`${ctx.prefix}voices\` to see the list.`,
      };
    }
    if (!peeled.remainder) {
      return { error: 'Provide some text to speak after the voice.' };
    }

    const segResult = SpeakCommand.parseSegments(peeled.remainder);
    if ('error' in segResult) return segResult;
    if (segResult.segments.length === 0) {
      return { error: 'Provide some text to speak.' };
    }
    return { segments: segResult.segments, defaultVoice: peeled.defaultVoice };
  }

  private static peelDefaultVoice(raw: string): {
    defaultVoice?: PollyVoice;
    voiceToken?: string;
    remainder: string;
  } {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(':')) return { remainder: trimmed };
    const rest = trimmed.slice(1);
    const spaceIdx = rest.search(/\s/);
    const token = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
    const remainder = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
    const found = findVoice(token);
    return { defaultVoice: found?.id, voiceToken: token, remainder };
  }

  private static parseSegments(
    input: string,
  ): { segments: SpeakSegment[] } | { error: string } {
    const segments: SpeakSegment[] = [];
    const tagRegex = /<([A-Za-z]+):([^>]+)>/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(input)) !== null) {
      const before = input.slice(lastIdx, match.index).trim();
      if (before) segments.push({ text: before });

      const [, voiceToken, segText] = match;
      const trimmedText = segText.trim();
      if (trimmedText) {
        const found = findVoice(voiceToken);
        if (!found) {
          return {
            error: `Unknown voice \`${voiceToken}\` in segment \`<${voiceToken}:...>\`.`,
          };
        }
        segments.push({ voice: found.id, text: trimmedText });
      }
      lastIdx = tagRegex.lastIndex;
    }

    const tail = input.slice(lastIdx).trim();
    if (tail) segments.push({ text: tail });

    return { segments };
  }

  private static truncateSegments(segments: SpeakSegment[], max: number): SpeakSegment[] {
    const result: SpeakSegment[] = [];
    let remaining = max;
    for (const seg of segments) {
      if (remaining <= 0) break;
      if (seg.text.length <= remaining) {
        result.push(seg);
        remaining -= seg.text.length;
      } else {
        result.push({ ...seg, text: seg.text.slice(0, remaining) });
        remaining = 0;
      }
    }
    return result;
  }

  private static uniquePreserveOrder(items: PollyVoice[]): PollyVoice[] {
    const seen = new Set<PollyVoice>();
    const out: PollyVoice[] = [];
    for (const item of items) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out;
  }
}
