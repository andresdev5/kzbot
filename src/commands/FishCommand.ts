import { ChannelType } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { FishAudioService } from '../core/FishAudioService';
import {
  AliasTakenError,
  ALIAS_REGEX,
  FishVoiceRegistryService,
  InvalidAliasError,
} from '../core/FishVoiceRegistryService';
import { VoiceManager } from '../core/VoiceManager';
import { Logger } from '../core/Logger';

const LEADING_ALIAS_TAG = /^\s*\[([^\]]+)\]\s*:?\s*/;
const LEADING_TAG = /^\s*<([^>]+)>\s*:?\s*/;

interface FishArgs {
  referenceId?: string;
  searchQuery?: string;
  aliasLookup?: string;
  saveAlias?: string;
  text: string;
}

@injectable()
export class FishCommand extends BaseCommand {
  readonly name = 'fish';
  readonly aliases = ['f'];
  readonly description = 'Speak using Fish Audio TTS (supports <reference_id> or <query> prefix)';
  readonly category = CommandCategory.Voice;
  readonly usage = 'fish [<reference_id|query>] <text>';
  readonly runOnEdit = true;
  readonly slash: SlashCommandConfig;

  constructor(
    @inject(FishAudioService) private readonly fish: FishAudioService,
    @inject(FishVoiceRegistryService) private readonly registry: FishVoiceRegistryService,
    @inject(VoiceManager) private readonly voice: VoiceManager,
    @inject(Logger) private readonly logger: Logger,
  ) {
    super();
    this.slash = {
      options: [
        {
          type: 'string',
          name: 'text',
          description: `Text to speak (max ${this.fish.getMaxTextLength()} chars).`,
          required: true,
          maxLength: this.fish.getMaxTextLength(),
        },
        {
          type: 'string',
          name: 'voice',
          description: 'Reference ID, alias, or search query. Omit to use default.',
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

    const max = this.fish.getMaxTextLength();
    const wasTruncated = parsed.text.length > max;
    const finalText = wasTruncated ? parsed.text.slice(0, max) : parsed.text;

    await ctx.defer();

    let referenceId = parsed.referenceId;
    let voiceLabel: string | undefined;
    let savedAliasNote: string | undefined;

    if (parsed.aliasLookup) {
      const found = this.registry.getAlias(parsed.aliasLookup);
      if (!found) {
        await ctx.reply(`Alias \`${parsed.aliasLookup}\` not found.`);
        return;
      }
      referenceId = found.referenceId;
      voiceLabel = `[${found.alias}] (\`${found.referenceId}\`)`;
    }

    if (!referenceId && parsed.searchQuery) {
      try {
        const result = await this.fish.searchVoices(parsed.searchQuery);
        if (result.items.length === 0) {
          await ctx.reply(`No Fish Audio voices found for \`${parsed.searchQuery}\`.`);
          return;
        }
        const first = result.items[0];
        referenceId = first.id;
        voiceLabel = `${first.title} (\`${first.id}\`)`;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error('[fish] search failed:', err);
        await ctx.reply(`Search failed: ${reason}`);
        return;
      }
    }

    if (parsed.saveAlias && referenceId) {
      try {
        const saved = this.registry.setAlias(parsed.saveAlias, referenceId);
        savedAliasNote = ` (saved alias \`${saved.alias}\`)`;
      } catch (err) {
        if (err instanceof InvalidAliasError) {
          await ctx.reply(`Invalid alias \`${parsed.saveAlias}\`. Allowed: a-zA-Z0-9_-, no spaces.`);
          return;
        }
        if (err instanceof AliasTakenError) {
          await ctx.reply(
            `Alias \`${err.alias}\` already points to \`${err.existingReferenceId}\`.`,
          );
          return;
        }
        throw err;
      }
    }

    if (!referenceId) {
      const stored = this.fish.getDefaultReferenceId();
      if (stored) referenceId = stored;
    }

    if (!voiceLabel && referenceId) {
      const aliasMatch = this.registry.aliasesFor(referenceId)[0];
      if (aliasMatch) {
        voiceLabel = `[${aliasMatch.alias}] (\`${referenceId}\`)`;
      } else {
        const cached = await this.fish.getVoiceById(referenceId).catch(() => null);
        voiceLabel = cached ? `${cached.title} (\`${cached.id}\`)` : `\`${referenceId}\``;
      }
    }

    try {
      this.logger.debug(
        `[fish] synthesize reference_id=${referenceId ?? '<none>'} len=${finalText.length}`,
      );
      const result = await this.fish.synthesizeToFile({ text: finalText, referenceId });
      this.logger.debug(
        `[fish] ${result.cached ? 'cache hit' : 'cache miss'} -> ${result.filePath}`,
      );
      await this.voice.play(channel, result.filePath);

      const voiceNote = voiceLabel ?? '_(no reference, model defaults)_';
      const truncNote = wasTruncated ? ` (truncated to ${max} chars)` : '';
      await ctx.reply(`Speaking with ${voiceNote}${truncNote}${savedAliasNote ?? ''}.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fish] synthesize failed:', err);
      await ctx.reply(`Fish Audio TTS failed: ${reason}`);
      throw err;
    }
  }

  private readArgs(ctx: CommandContext): FishArgs | { error: string } {
    if (ctx.source === 'interaction') {
      const text = ctx.interaction!.options.getString('text', true).trim();
      const voiceArg = ctx.interaction!.options.getString('voice')?.trim();
      if (!text) return { error: 'Provide some text to speak.' };
      if (!voiceArg) return { text };
      if (FishAudioService.isReferenceId(voiceArg)) {
        return { referenceId: voiceArg, text };
      }
      if (ALIAS_REGEX.test(voiceArg) && this.registry.getAlias(voiceArg)) {
        return { aliasLookup: voiceArg, text };
      }
      return { searchQuery: voiceArg, text };
    }

    const raw = ctx.rawArgs;
    if (!raw.trim()) return { error: 'Provide some text to speak.' };

    const aliasMatch = raw.match(LEADING_ALIAS_TAG);
    if (aliasMatch) {
      const alias = aliasMatch[1].trim();
      const text = raw.slice(aliasMatch[0].length).trim();
      if (!text) return { error: 'Provide some text to speak after the alias.' };
      if (!ALIAS_REGEX.test(alias)) {
        return { error: `Invalid alias \`${alias}\`. Allowed: a-zA-Z0-9_-, no spaces.` };
      }
      return { aliasLookup: alias, text };
    }

    const tagMatch = raw.match(LEADING_TAG);
    if (!tagMatch) return { text: raw.trim() };

    const tagContent = tagMatch[1].trim();
    const text = raw.slice(tagMatch[0].length).trim();
    if (!text) return { error: 'Provide some text to speak after the voice tag.' };

    const colonIdx = tagContent.indexOf(':');
    if (colonIdx > -1) {
      const idPart = tagContent.slice(0, colonIdx).trim();
      const aliasPart = tagContent.slice(colonIdx + 1).trim();
      if (!FishAudioService.isReferenceId(idPart)) {
        return {
          error: `Expected \`<reference_id:alias>\` but \`${idPart}\` is not a 32-hex reference id.`,
        };
      }
      if (!ALIAS_REGEX.test(aliasPart)) {
        return { error: `Invalid alias \`${aliasPart}\`. Allowed: a-zA-Z0-9_-, no spaces.` };
      }
      return { referenceId: idPart, saveAlias: aliasPart, text };
    }

    if (FishAudioService.isReferenceId(tagContent)) {
      return { referenceId: tagContent, text };
    }
    return { searchQuery: tagContent, text };
  }
}
