import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { findVoice } from '../models/VoiceCatalog';
import { PollyService } from '../core/PollyService';

@injectable()
export class VoiceCommand extends BaseCommand {
  readonly name = 'voice';
  readonly aliases = ['setvoice'];
  readonly description = 'Sets the default Polly voice (e.g. "voice Ricardo")';
  readonly category = CommandCategory.Voice;
  readonly usage = 'voice <name>';
  readonly slash: SlashCommandConfig = {
    options: [
      {
        type: 'string',
        name: 'name',
        description: 'Voice ID to set as default. Omit to show the current one.',
        required: false,
      },
    ],
  };

  constructor(@inject(PollyService) private readonly polly: PollyService) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const requested = ctx.source === 'interaction'
      ? ctx.interaction!.options.getString('name') ?? undefined
      : ctx.args[0];

    if (!requested) {
      const current = this.polly.getDefaultVoice();
      await ctx.reply(
        `Current default voice: \`${current}\`. Use \`${ctx.prefix}voices\` to list options.`,
      );
      return;
    }

    const voice = findVoice(requested);
    if (!voice) {
      await ctx.reply(
        `Unknown voice \`${requested}\`. Use \`${ctx.prefix}voices\` to see the full list.`,
      );
      return;
    }

    this.polly.setDefaultVoice(voice.id);
    await ctx.reply(
      `Default voice set to \`${voice.id}\` (${voice.language}, ${voice.gender}).`,
    );
  }
}
