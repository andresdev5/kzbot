import { EmbedBuilder } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { VOICE_CATALOG, groupByLanguage } from '../models/VoiceCatalog';
import { PollyService } from '../core/PollyService';

@injectable()
export class VoicesCommand extends BaseCommand {
  readonly name = 'voices';
  readonly aliases = ['vs', 'listvoices'];
  readonly description = 'Lists all available Polly Standard voices';
  readonly category = CommandCategory.Voice;
  readonly usage = 'voices';

  constructor(@inject(PollyService) private readonly polly: PollyService) {
    super();
  }

  async execute({ message, prefix }: CommandContext): Promise<void> {
    const groups = groupByLanguage();
    const current = this.polly.getDefaultVoice();

    const lines: string[] = [];
    for (const [language, voices] of groups) {
      const formatted = voices
        .map((v) => `\`${v.id}\` (${VoicesCommand.shortGender(v.gender)})`)
        .join(', ');
      lines.push(`**${language}** — ${formatted}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Polly Standard Voices (${VOICE_CATALOG.length})`)
      .setDescription(
        `Current default: \`${current}\`. Change with \`${prefix}voice <name>\`.\n\n` +
          lines.join('\n'),
      )
      .setColor(0x5865f2);

    await message.reply({ embeds: [embed] });
  }

  private static shortGender(gender: string): string {
    if (gender.startsWith('Female')) return gender.includes('child') ? 'F-c' : 'F';
    if (gender.startsWith('Male')) return gender.includes('child') ? 'M-c' : 'M';
    return gender;
  }
}
