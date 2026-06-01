import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import {
  ClipAliasTakenError,
  ClipNotFoundError,
  FishClipRegistryService,
  InvalidClipAliasError,
} from '../core/FishClipRegistryService';
import { Logger } from '../core/Logger';

@injectable()
export class FishAliasCommand extends BaseCommand {
  readonly name = 'fishalias';
  readonly description = 'Save a played Fish Audio clip (by its uid) under your own alias';
  readonly category = CommandCategory.Voice;
  readonly usage = 'fishalias <uid> <alias>';
  readonly slash: SlashCommandConfig = {
    options: [
      {
        type: 'string',
        name: 'uid',
        description: 'The clip uid shown in the "Speaking with ... | uid: N" reply.',
        required: true,
      },
      {
        type: 'string',
        name: 'alias',
        description: 'Memorable alias (a-zA-Z0-9_-, no spaces). Replay it with {alias}.',
        required: true,
      },
    ],
  };

  constructor(
    @inject(FishClipRegistryService) private readonly clips: FishClipRegistryService,
    @inject(Logger) private readonly logger: Logger,
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    let uidRaw: string;
    let alias: string;

    if (ctx.source === 'interaction') {
      uidRaw = ctx.interaction!.options.getString('uid', true).trim();
      alias = ctx.interaction!.options.getString('alias', true).trim();
    } else {
      const parts = ctx.rawArgs.trim().split(/\s+/);
      if (parts.length < 2) {
        await ctx.reply(`Usage: \`${ctx.prefix}fishalias <uid> <alias>\`.`);
        return;
      }
      [uidRaw, alias] = parts;
    }

    if (!/^\d+$/.test(uidRaw)) {
      await ctx.reply(`\`${uidRaw}\` is not a valid clip uid (expected a number).`);
      return;
    }
    const uid = Number(uidRaw);

    try {
      const saved = this.clips.setAlias(ctx.userId, alias, uid);
      await ctx.reply(
        `Saved your clip alias \`${saved.alias}\` → uid \`${uid}\`. Replay it with \`${ctx.prefix}fish {${saved.alias}}\`.`,
      );
    } catch (err) {
      if (err instanceof InvalidClipAliasError) {
        await ctx.reply(`Invalid alias \`${alias}\`. Allowed: a-zA-Z0-9_-, no spaces.`);
        return;
      }
      if (err instanceof ClipNotFoundError) {
        await ctx.reply(`No clip found with uid \`${uid}\`. Play something with \`${ctx.prefix}fish\` first.`);
        return;
      }
      if (err instanceof ClipAliasTakenError) {
        await ctx.reply(
          `You already use alias \`${err.alias}\` for uid \`${err.existingClipUid}\`. Pick a different name.`,
        );
        return;
      }
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[fishalias] failed:', err);
      await ctx.reply(`Failed to save alias: ${reason}`);
    }
  }
}
