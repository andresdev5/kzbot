import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { FishAudioService } from '../core/FishAudioService';
import { Logger } from '../core/Logger';

@injectable()
export class FishDefaultCommand extends BaseCommand {
  readonly name = 'fishdefault';
  readonly aliases = ['fishvoice', 'fishd'];
  readonly description = 'Sets the default Fish Audio voice by reference_id or search query';
  readonly category = CommandCategory.Voice;
  readonly usage = 'fishdefault <reference_id | search query>';
  readonly slash: SlashCommandConfig = {
    options: [
      {
        type: 'string',
        name: 'voice',
        description: 'Reference ID (32 hex chars) or search query.',
        required: false,
      },
    ],
  };

  constructor(
    @inject(FishAudioService) private readonly fish: FishAudioService,
    @inject(Logger) private readonly logger: Logger,
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const input =
      ctx.source === 'interaction'
        ? (ctx.interaction!.options.getString('voice') ?? '').trim()
        : ctx.rawArgs.trim();

    if (!input) {
      const current = this.fish.getDefaultReferenceId();
      if (!current) {
        await ctx.reply(
          `No default Fish voice set. Use \`${ctx.prefix}fishdefault <reference_id | query>\`.`,
        );
        return;
      }
      const voice = await this.fish.getVoiceById(current).catch(() => null);
      const label = voice
        ? `\`${voice.id}\` — ${voice.title} (by ${voice.authorNickname})`
        : `\`${current}\``;
      await ctx.reply(`Current default Fish voice: ${label}.`);
      return;
    }

    await ctx.defer();

    if (FishAudioService.isReferenceId(input)) {
      const voice = await this.fish.getVoiceById(input).catch((err) => {
        this.logger.error('[fishdefault] lookup failed:', err);
        return null;
      });
      if (!voice) {
        this.fish.setDefaultReferenceId(input);
        await ctx.reply(
          `Default Fish voice set to \`${input}\` (could not fetch metadata — saved anyway).`,
        );
        return;
      }
      this.fish.setDefaultReferenceId(voice.id);
      await ctx.reply(
        `Default Fish voice set to \`${voice.id}\` — **${voice.title}** by *${voice.authorNickname}*.`,
      );
      return;
    }

    try {
      const result = await this.fish.searchVoices(input);
      if (result.items.length === 0) {
        await ctx.reply(`No Fish Audio voices found for \`${input}\`.`);
        return;
      }
      const first = result.items[0];
      this.fish.setDefaultReferenceId(first.id);
      await ctx.reply(
        `Default Fish voice set to \`${first.id}\` — **${first.title}** by *${first.authorNickname}* (first result for \`${input}\`).`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fishdefault] search failed:', err);
      await ctx.reply(`Search failed: ${reason}`);
    }
  }
}
