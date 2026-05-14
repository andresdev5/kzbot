import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
} from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { FishAlias, FishVoiceRegistryService } from '../core/FishVoiceRegistryService';

const PAGE_SIZE = 8;
const COLLECTOR_MS = 5 * 60_000;

@injectable()
export class FishIdListCommand extends BaseCommand {
  readonly name = 'fishidlist';
  readonly aliases = ['fishaliases', 'fishids'];
  readonly description = 'List saved Fish Audio aliases (paginated)';
  readonly category = CommandCategory.Voice;
  readonly usage = 'fishidlist';
  readonly slash: SlashCommandConfig = {};

  constructor(@inject(FishVoiceRegistryService) private readonly registry: FishVoiceRegistryService) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const aliases = this.registry.listAliases();
    if (aliases.length === 0) {
      await ctx.reply(
        `No Fish Audio aliases saved yet. Use \`${ctx.prefix}fishid <reference_id> <alias>\`.`,
      );
      return;
    }

    const userId =
      ctx.source === 'interaction' ? ctx.interaction!.user.id : ctx.message!.author.id;
    const totalPages = Math.max(1, Math.ceil(aliases.length / PAGE_SIZE));
    let page = 0;

    const embed = this.buildEmbed(aliases, page, totalPages);
    const row = FishIdListCommand.buildButtons(page, totalPages);

    const sent = await ctx.send({ embeds: [embed], components: row ? [row] : [] });
    if (!sent || totalPages === 1) return;

    this.attachCollector(sent, userId, aliases, () => page, (p) => (page = p));
  }

  private attachCollector(
    message: Message,
    userId: string,
    aliases: FishAlias[],
    getPage: () => number,
    setPage: (p: number) => void,
  ): void {
    const totalPages = Math.max(1, Math.ceil(aliases.length / PAGE_SIZE));
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_MS,
    });

    collector.on('collect', async (interaction: ButtonInteraction) => {
      if (interaction.user.id !== userId) {
        await interaction
          .reply({ content: 'Only the user who ran the command can navigate.', ephemeral: true })
          .catch(() => undefined);
        return;
      }
      let page = getPage();
      if (interaction.customId === 'fishidlist:prev') page = Math.max(0, page - 1);
      else if (interaction.customId === 'fishidlist:next') page = Math.min(totalPages - 1, page + 1);
      setPage(page);

      const embed = this.buildEmbed(aliases, page, totalPages);
      const row = FishIdListCommand.buildButtons(page, totalPages);
      await interaction
        .update({ embeds: [embed], components: row ? [row] : [] })
        .catch(() => undefined);
    });

    collector.on('end', () => {
      message.edit({ components: [] }).catch(() => undefined);
    });
  }

  private buildEmbed(aliases: FishAlias[], page: number, totalPages: number): EmbedBuilder {
    const start = page * PAGE_SIZE;
    const slice = aliases.slice(start, start + PAGE_SIZE);
    const lines = slice.map((a, idx) => {
      const voice = this.registry.getVoice(a.referenceId);
      const title = voice?.title ? ` — ${voice.title}` : '';
      const author = voice?.authorNickname ? ` (by ${voice.authorNickname})` : '';
      return `**${start + idx + 1}.** \`${a.alias}\` → \`${a.referenceId}\`${title}${author}`;
    });

    return new EmbedBuilder()
      .setTitle(`Fish Audio aliases (${aliases.length})`)
      .setDescription(lines.join('\n') || '_(empty)_')
      .setFooter({ text: `Page ${page + 1}/${totalPages}` })
      .setColor(0x33b3ff);
  }

  private static buildButtons(
    page: number,
    totalPages: number,
  ): ActionRowBuilder<ButtonBuilder> | null {
    if (totalPages <= 1) return null;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('fishidlist:prev')
        .setLabel('Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId('fishidlist:next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
    );
  }
}
