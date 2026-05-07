import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { findVoice } from '../models/VoiceCatalog';
import { PollyService } from '../core/PollyService';

@injectable()
export class VoiceCommand extends BaseCommand {
  readonly name = 'voice';
  readonly aliases = ['setvoice'];
  readonly description = 'Sets the default Polly voice (e.g. "voice Ricardo")';
  readonly category = CommandCategory.Voice;
  readonly usage = 'voice <name>';

  constructor(@inject(PollyService) private readonly polly: PollyService) {
    super();
  }

  async execute({ message, args, prefix }: CommandContext): Promise<void> {
    const requested = args[0];
    if (!requested) {
      const current = this.polly.getDefaultVoice();
      await message.reply(
        `Current default voice: \`${current}\`. Use \`${prefix}voices\` to list options.`,
      );
      return;
    }

    const voice = findVoice(requested);
    if (!voice) {
      await message.reply(
        `Unknown voice \`${requested}\`. Use \`${prefix}voices\` to see the full list.`,
      );
      return;
    }

    this.polly.setDefaultVoice(voice.id);
    await message.reply(
      `Default voice set to \`${voice.id}\` (${voice.language}, ${voice.gender}).`,
    );
  }
}
