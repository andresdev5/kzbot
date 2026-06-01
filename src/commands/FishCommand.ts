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
import { FishClipRegistryService, FishClipSegment } from '../core/FishClipRegistryService';
import { Logger } from '../core/Logger';

const LEADING_ALIAS_TAG = /^\s*\[([^\]]+)\]\s*:?\s*/;
const LEADING_TAG = /^\s*<([^>]+)>\s*:?\s*/;
const SEGMENT_TAG = /<([^:>]+):([^>]+)>/g;
const CLIP_REPLAY = /^\s*\{([^}]+)\}\s*$/;

interface FishArgs {
  referenceId?: string;
  searchQuery?: string;
  aliasLookup?: string;
  saveAlias?: string;
  text: string;
}

interface FishSegment {
  /** Raw voice token (alias, reference id, or search query). Undefined uses the default voice. */
  token?: string;
  text: string;
}

interface ResolvedToken {
  referenceId?: string;
  label: string;
}

@injectable()
export class FishCommand extends BaseCommand {
  readonly name = 'fish';
  readonly aliases = ['f'];
  readonly description =
    'Speak using Fish Audio TTS (supports <reference_id>/<query> prefix, <voice:text> multi-voice, and {alias} clip replay)';
  readonly category = CommandCategory.Voice;
  readonly usage =
    'fish [<reference_id|query>] <text> — <voice:fragment> for multi-voice, {alias} to replay a saved clip';
  readonly runOnEdit = true;
  readonly slash: SlashCommandConfig;

  constructor(
    @inject(FishAudioService) private readonly fish: FishAudioService,
    @inject(FishVoiceRegistryService) private readonly registry: FishVoiceRegistryService,
    @inject(FishClipRegistryService) private readonly clips: FishClipRegistryService,
    @inject(VoiceManager) private readonly voice: VoiceManager,
    @inject(Logger) private readonly logger: Logger,
  ) {
    super();
    this.slash = {
      options: [
        {
          type: 'string',
          name: 'text',
          description: `Text to speak (max ${this.fish.getMaxTextLength()} chars). Use {alias} to replay a saved clip.`,
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
    const rawText =
      ctx.source === 'interaction'
        ? ctx.interaction!.options.getString('text', true)
        : ctx.rawArgs;

    const replayMatch = rawText.match(CLIP_REPLAY);
    if (replayMatch) {
      await this.executeReplay(ctx, replayMatch[1].trim());
      return;
    }

    if (FishCommand.isMultiVoice(rawText)) {
      await this.executeMulti(ctx, rawText);
      return;
    }

    await this.executeSingle(ctx);
  }

  /** Replay a previously played clip referenced by `{alias}` or `{uid}` (scoped to the user). */
  private async executeReplay(ctx: CommandContext, token: string): Promise<void> {
    const channel = await this.resolveVoiceChannel(ctx);
    if (!channel) return;

    const clip = this.clips.resolveClip(token);
    if (!clip || clip.segments.length === 0) {
      await ctx.reply(`No saved clip for \`{${token}}\`. Save one with \`${ctx.prefix}fishalias <uid> <alias>\`.`);
      return;
    }

    await ctx.defer();

    try {
      const results = await Promise.all(
        clip.segments.map((seg) =>
          this.fish.synthesizeToFile({
            text: seg.text,
            referenceId: seg.referenceId || undefined,
          }),
        ),
      );
      const filePaths = results.map((r) => r.filePath);
      this.logger.debug(`[fish] replay clip uid=${clip.uid} segments=${filePaths.length}`);
      await this.voice.playSequence(channel, filePaths);
      await ctx.reply(`Replaying clip \`{${token}}\` (uid \`${clip.uid}\`).`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fish] replay failed:', err);
      await ctx.reply(`Fish Audio replay failed: ${reason}`);
      throw err;
    }
  }

  private async executeSingle(ctx: CommandContext): Promise<void> {
    const parsed = this.readArgs(ctx);
    if ('error' in parsed) {
      await ctx.reply(parsed.error);
      return;
    }

    const channel = await this.resolveVoiceChannel(ctx);
    if (!channel) return;

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

      const uidNote = this.recordClip([{ referenceId: referenceId ?? '', text: finalText }]);
      const voiceNote = voiceLabel ?? '_(no reference, model defaults)_';
      const truncNote = wasTruncated ? ` (truncated to ${max} chars)` : '';
      await ctx.reply(`Speaking with ${voiceNote}${truncNote}${savedAliasNote ?? ''}.${uidNote}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fish] synthesize failed:', err);
      await ctx.reply(`Fish Audio TTS failed: ${reason}`);
      throw err;
    }
  }

  private async executeMulti(ctx: CommandContext, rawText: string): Promise<void> {
    const channel = await this.resolveVoiceChannel(ctx);
    if (!channel) return;

    const segments = FishCommand.buildSegments(rawText);
    if (segments.length === 0) {
      await ctx.reply('Provide some text to speak.');
      return;
    }

    const max = this.fish.getMaxTextLength();
    const totalLen = segments.reduce((n, s) => n + s.text.length, 0);
    const wasTruncated = totalLen > max;
    const finalSegments = wasTruncated ? FishCommand.truncateSegments(segments, max) : segments;
    if (finalSegments.length === 0) {
      await ctx.reply('Provide some text to speak.');
      return;
    }

    await ctx.defer();

    // Resolve the default voice (slash `voice` option, then stored default).
    const defaultVoiceArg =
      ctx.source === 'interaction'
        ? ctx.interaction!.options.getString('voice')?.trim() || undefined
        : undefined;
    let defaultReferenceId: string | undefined;
    if (defaultVoiceArg) {
      const resolved = await this.resolveToken(defaultVoiceArg);
      if ('error' in resolved) {
        await ctx.reply(resolved.error);
        return;
      }
      defaultReferenceId = resolved.referenceId;
    } else {
      defaultReferenceId = this.fish.getDefaultReferenceId();
    }

    // Resolve each unique voice token once.
    const resolvedTokens = new Map<string, ResolvedToken>();
    for (const seg of finalSegments) {
      if (!seg.token || resolvedTokens.has(seg.token)) continue;
      const resolved = await this.resolveToken(seg.token);
      if ('error' in resolved) {
        await ctx.reply(resolved.error);
        return;
      }
      resolvedTokens.set(seg.token, resolved);
    }

    try {
      const results = await Promise.all(
        finalSegments.map((seg) => {
          const referenceId = seg.token
            ? resolvedTokens.get(seg.token)!.referenceId
            : defaultReferenceId;
          return this.fish.synthesizeToFile({ text: seg.text, referenceId });
        }),
      );
      for (const r of results) {
        this.logger.debug(
          `[fish] ${r.cached ? 'cache hit' : 'cache miss'} (${r.referenceId || '<default>'}) -> ${r.filePath}`,
        );
      }

      const filePaths = results.map((r) => r.filePath);
      this.logger.debug(`[fish] playing ${filePaths.length} segment(s) in #${channel.name}`);
      await this.voice.playSequence(channel, filePaths);

      const clipSegments: FishClipSegment[] = finalSegments.map((seg) => ({
        referenceId: (seg.token ? resolvedTokens.get(seg.token)!.referenceId : defaultReferenceId) ?? '',
        text: seg.text,
      }));
      const uidNote = this.recordClip(clipSegments);

      const labels = FishCommand.uniquePreserveOrder(
        finalSegments.map((seg) =>
          seg.token ? resolvedTokens.get(seg.token)!.label : defaultReferenceId ? `\`${defaultReferenceId}\`` : '_(default)_',
        ),
      );
      const voiceList = labels.join(', ');
      const truncNote = wasTruncated ? ` (truncated to ${max} chars)` : '';
      await ctx.reply(`Speaking with ${voiceList}${truncNote}.${uidNote}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fish] multi-voice synthesize failed:', err);
      await ctx.reply(`Fish Audio TTS failed: ${reason}`);
      throw err;
    }
  }

  /** Persist the played clip and return the ` | uid: \`N\`` note to append to the reply. */
  private recordClip(segments: FishClipSegment[]): string {
    try {
      const clip = this.clips.recordClip(segments);
      return ` | uid: \`${clip.uid}\``;
    } catch (err) {
      this.logger.error('[fish] failed to record clip:', err);
      return '';
    }
  }

  private async resolveVoiceChannel(ctx: CommandContext) {
    const member = await ctx.getMember();
    const channel = member?.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply('You must be in a voice channel.');
      return null;
    }
    return channel;
  }

  /** Resolve a voice token (alias, reference id, or search query) to a reference id + display label. */
  private async resolveToken(token: string): Promise<ResolvedToken | { error: string }> {
    const alias = this.registry.getAlias(token);
    if (alias) {
      return { referenceId: alias.referenceId, label: `[${alias.alias}] (\`${alias.referenceId}\`)` };
    }

    if (FishAudioService.isReferenceId(token)) {
      const aliasMatch = this.registry.aliasesFor(token)[0];
      if (aliasMatch) return { referenceId: token, label: `[${aliasMatch.alias}] (\`${token}\`)` };
      const cached = await this.fish.getVoiceById(token).catch(() => null);
      return { referenceId: token, label: cached ? `${cached.title} (\`${token}\`)` : `\`${token}\`` };
    }

    try {
      const result = await this.fish.searchVoices(token);
      if (result.items.length === 0) {
        return { error: `No Fish Audio voices found for \`${token}\`.` };
      }
      const first = result.items[0];
      return { referenceId: first.id, label: `${first.title} (\`${first.id}\`)` };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fish] multi-voice search failed:', err);
      return { error: `Search failed for \`${token}\`: ${reason}` };
    }
  }

  /**
   * Multi-voice mode triggers when the text has 2+ `<token:fragment>` segments, or a single one
   * whose token is not a 32-hex reference id (which would be the `<reference_id:alias>` save form).
   */
  private static isMultiVoice(raw: string): boolean {
    if (!raw) return false;
    const tags = FishCommand.segmentTags(raw);
    if (tags.length >= 2) return true;
    return tags.length === 1 && !FishAudioService.isReferenceId(tags[0]);
  }

  private static segmentTags(input: string): string[] {
    const tokens: string[] = [];
    SEGMENT_TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SEGMENT_TAG.exec(input)) !== null) {
      tokens.push(match[1].trim());
    }
    return tokens;
  }

  private static buildSegments(input: string): FishSegment[] {
    const segments: FishSegment[] = [];
    SEGMENT_TAG.lastIndex = 0;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = SEGMENT_TAG.exec(input)) !== null) {
      const before = input.slice(lastIdx, match.index).trim();
      if (before) segments.push({ text: before });

      const token = match[1].trim();
      const text = match[2].trim();
      if (text) segments.push({ token: token || undefined, text });
      lastIdx = SEGMENT_TAG.lastIndex;
    }
    const tail = input.slice(lastIdx).trim();
    if (tail) segments.push({ text: tail });
    return segments;
  }

  private static truncateSegments(segments: FishSegment[], max: number): FishSegment[] {
    const result: FishSegment[] = [];
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

  private static uniquePreserveOrder(items: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out;
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
