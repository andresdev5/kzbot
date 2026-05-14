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
import { FishAudioService } from '../core/FishAudioService';
import { Logger } from '../core/Logger';
import { FishVoice } from '../models/FishVoice';

const PAGE_SIZE = 6;
const COLLECTOR_MS = 5 * 60_000;
const LANG_PREFIX = /^([A-Za-z]{2,5}):(.*)$/;

interface ParsedQuery {
  language?: string;
  query: string;
}

@injectable()
export class FishVoicesCommand extends BaseCommand {
  readonly name = 'voices';
  readonly aliases = ['fishvoices', 'fv'];
  readonly description = 'Search Fish Audio voice models (paginated)';
  readonly category = CommandCategory.Voice;
  readonly usage = 'voices [lang:]<query>';
  readonly slash: SlashCommandConfig = {
    options: [
      {
        type: 'string',
        name: 'query',
        description: 'Voice title to search.',
        required: false,
      },
      {
        type: 'string',
        name: 'language',
        description: 'Language filter (e.g. es, en, ja).',
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
    const parsed = this.readArgs(ctx);
    await ctx.defer();

    let items: FishVoice[];
    let total: number;
    try {
      const result = await this.fish.searchVoices(parsed.query, parsed.language);
      items = result.items;
      total = result.total;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('[voices] search failed:', err);
      await ctx.reply(`Search failed: ${reason}`);
      return;
    }

    if (items.length === 0) {
      await ctx.reply(
        `No Fish Audio voices found for \`${parsed.query || '<top>'}\`` +
          (parsed.language ? ` in \`${parsed.language}\`` : '') +
          '.',
      );
      return;
    }

    const userId =
      ctx.source === 'interaction' ? ctx.interaction!.user.id : ctx.message!.author.id;

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    let page = 0;

    const embed = FishVoicesCommand.buildEmbed(items, page, totalPages, total, parsed);
    const row = FishVoicesCommand.buildButtons(page, totalPages);

    const sent = await ctx.send({ embeds: [embed], components: row ? [row] : [] });
    if (!sent || totalPages === 1) return;

    this.attachCollector(sent, userId, items, total, parsed, () => page, (p) => (page = p));
  }

  private attachCollector(
    message: Message,
    userId: string,
    items: FishVoice[],
    total: number,
    parsed: ParsedQuery,
    getPage: () => number,
    setPage: (p: number) => void,
  ): void {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
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
      if (interaction.customId === 'fishvoices:prev') page = Math.max(0, page - 1);
      else if (interaction.customId === 'fishvoices:next') page = Math.min(totalPages - 1, page + 1);
      setPage(page);

      const embed = FishVoicesCommand.buildEmbed(items, page, totalPages, total, parsed);
      const row = FishVoicesCommand.buildButtons(page, totalPages);
      await interaction
        .update({ embeds: [embed], components: row ? [row] : [] })
        .catch(() => undefined);
    });

    collector.on('end', () => {
      message.edit({ components: [] }).catch(() => undefined);
    });
  }

  private readArgs(ctx: CommandContext): ParsedQuery {
    if (ctx.source === 'interaction') {
      const query = (ctx.interaction!.options.getString('query') ?? '').trim();
      const language = (ctx.interaction!.options.getString('language') ?? '').trim() || undefined;
      return { query, language };
    }
    const raw = ctx.rawArgs.trim();
    const match = raw.match(LANG_PREFIX);
    if (match) {
      return { language: match[1].toLowerCase(), query: match[2].trim() };
    }
    return { query: raw };
  }

  private static buildEmbed(
    items: FishVoice[],
    page: number,
    totalPages: number,
    apiTotal: number,
    parsed: ParsedQuery,
  ): EmbedBuilder {
    const start = page * PAGE_SIZE;
    const slice = items.slice(start, start + PAGE_SIZE);

    const description = slice
      .map((v, idx) => {
        const langs = v.languages.length > 0 ? v.languages.join(', ') : '—';
        const author = v.authorNickname || '—';
        return `**${start + idx + 1}.** \`${v.id}\`\n` +
          `Title: ${v.title || '—'}\n` +
          `Author: ${author}\n` +
          `Language: ${langs}`;
      })
      .join('\n\n');

    const filters: string[] = [];
    if (parsed.query) filters.push(`query=\`${parsed.query}\``);
    if (parsed.language) filters.push(`lang=\`${parsed.language}\``);
    const title = filters.length > 0
      ? `Fish Audio voices — ${filters.join(' ')}`
      : 'Fish Audio voices';

    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description || '_(empty page)_')
      .setFooter({
        text: `Page ${page + 1}/${totalPages} — showing ${items.length} of ${apiTotal} matches`,
      })
      .setColor(0x33b3ff);
  }

  private static buildButtons(
    page: number,
    totalPages: number,
  ): ActionRowBuilder<ButtonBuilder> | null {
    if (totalPages <= 1) return null;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('fishvoices:prev')
        .setLabel('Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId('fishvoices:next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
    );
  }
}
