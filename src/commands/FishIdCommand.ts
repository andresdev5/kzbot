import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { FishAudioService } from '../core/FishAudioService';
import {
  AliasTakenError,
  FishVoiceRegistryService,
  InvalidAliasError,
} from '../core/FishVoiceRegistryService';
import { Logger } from '../core/Logger';

@injectable()
export class FishIdCommand extends BaseCommand {
  readonly name = 'fishid';
  readonly aliases = ['fishalias'];
  readonly description = 'Save a memorable alias for a Fish Audio reference_id';
  readonly category = CommandCategory.Voice;
  readonly usage = 'fishid <reference_id> <alias>';
  readonly slash: SlashCommandConfig = {
    options: [
      {
        type: 'string',
        name: 'reference_id',
        description: 'The 32-hex Fish Audio reference_id.',
        required: true,
      },
      {
        type: 'string',
        name: 'alias',
        description: 'Memorable alias (a-zA-Z0-9_-, no spaces).',
        required: true,
      },
    ],
  };

  constructor(
    @inject(FishAudioService) private readonly fish: FishAudioService,
    @inject(FishVoiceRegistryService) private readonly registry: FishVoiceRegistryService,
    @inject(Logger) private readonly logger: Logger,
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    let referenceId: string;
    let alias: string;

    if (ctx.source === 'interaction') {
      referenceId = ctx.interaction!.options.getString('reference_id', true).trim();
      alias = ctx.interaction!.options.getString('alias', true).trim();
    } else {
      const parts = ctx.rawArgs.trim().split(/\s+/);
      if (parts.length < 2) {
        await ctx.reply(`Usage: \`${ctx.prefix}fishid <reference_id> <alias>\`.`);
        return;
      }
      [referenceId, alias] = parts;
    }

    if (!FishAudioService.isReferenceId(referenceId)) {
      await ctx.reply(`\`${referenceId}\` is not a valid reference_id (expected 32 hex chars).`);
      return;
    }

    try {
      const saved = this.registry.setAlias(alias, referenceId);
      await this.fish.getVoiceById(referenceId).catch(() => null);
      const meta = this.registry.getVoice(referenceId);
      const label = meta ? ` — **${meta.title}** by *${meta.authorNickname}*` : '';
      await ctx.reply(
        `Saved alias \`${saved.alias}\` → \`${referenceId}\`${label}. Use it as \`${ctx.prefix}fish [${saved.alias}]:text\`.`,
      );
    } catch (err) {
      if (err instanceof InvalidAliasError) {
        await ctx.reply(`Invalid alias \`${alias}\`. Allowed: a-zA-Z0-9_-, no spaces.`);
        return;
      }
      if (err instanceof AliasTakenError) {
        await ctx.reply(
          `Alias \`${err.alias}\` already points to \`${err.existingReferenceId}\`. Pick a different name.`,
        );
        return;
      }
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fishid] failed:', err);
      await ctx.reply(`Failed to save alias: ${reason}`);
    }
  }
}
