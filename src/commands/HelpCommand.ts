import { EmbedBuilder } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { ICommand } from './ICommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig, SlashOption } from '../models/SlashCommandConfig';
import { CommandHandler } from '../core/CommandHandler';
import { Config } from '../core/Config';

const CATEGORY_ORDER: CommandCategory[] = [
  CommandCategory.General,
  CommandCategory.Voice,
  CommandCategory.Utility,
  CommandCategory.Admin,
];

const CATEGORY_LABEL: Record<CommandCategory, string> = {
  [CommandCategory.General]: 'General',
  [CommandCategory.Voice]: 'Voice',
  [CommandCategory.Utility]: 'Utility',
  [CommandCategory.Admin]: 'Admin',
};

@injectable()
export class HelpCommand extends BaseCommand {
  readonly name = 'help';
  readonly aliases = ['h', 'commands'];
  readonly description = 'Lists commands or shows detailed help for a specific command';
  readonly category = CommandCategory.General;
  readonly usage = 'help [command]';
  readonly slash: SlashCommandConfig = {
    options: [
      {
        type: 'string',
        name: 'command',
        description: 'Show detailed help for a specific command.',
        required: false,
      },
    ],
  };

  constructor(
    @inject(CommandHandler) private readonly commands: CommandHandler,
    @inject(Config) private readonly config: Config,
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const target =
      ctx.source === 'interaction'
        ? ctx.interaction!.options.getString('command')?.trim()
        : ctx.args[0]?.trim();

    if (!target) {
      await ctx.reply({ embeds: [this.buildOverview(ctx.prefix)] });
      return;
    }

    const command = this.commands.resolve(target.toLowerCase());
    if (!command) {
      await ctx.reply(
        `Unknown command \`${target}\`. Run \`${ctx.prefix}help\` to see the list.`,
      );
      return;
    }
    await ctx.reply({ embeds: [this.buildDetail(command, ctx.prefix)] });
  }

  private buildOverview(prefix: string): EmbedBuilder {
    const all = this.commands.list();
    const grouped = new Map<CommandCategory, ICommand[]>();
    for (const cmd of all) {
      const list = grouped.get(cmd.category) ?? [];
      list.push(cmd);
      grouped.set(cmd.category, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const sections: string[] = [];
    for (const cat of CATEGORY_ORDER) {
      const list = grouped.get(cat);
      if (!list || list.length === 0) continue;
      const lines = list.map((c) => `\`${prefix}${c.name}\` — ${c.description}`).join('\n');
      sections.push(`**${CATEGORY_LABEL[cat]}**\n${lines}`);
    }

    const aliasPrefixes = this.config.getOrDefault<Record<string, string>>(
      'bot.aliasPrefixes',
      {},
    );
    const aliasLines = Object.entries(aliasPrefixes)
      .map(([p, cmd]) => `\`${p}\` → \`${prefix}${cmd}\``)
      .join(', ');

    return new EmbedBuilder()
      .setTitle('Commands')
      .setDescription(
        `Use \`${prefix}help <command>\` for details.\n\n` +
          sections.join('\n\n') +
          (aliasLines ? `\n\n**Prefix shortcuts**\n${aliasLines}` : ''),
      )
      .setColor(0x5865f2);
  }

  private buildDetail(command: ICommand, prefix: string): EmbedBuilder {
    const lines: string[] = [];
    lines.push(command.description);
    lines.push('');
    lines.push(`**Usage** \`${prefix}${command.usage ?? command.name}\``);

    if (command.aliases.length > 0) {
      const formatted = command.aliases.map((a) => `\`${prefix}${a}\``).join(', ');
      lines.push(`**Aliases** ${formatted}`);
    }

    lines.push(`**Category** ${CATEGORY_LABEL[command.category] ?? command.category}`);

    if (command.runOnEdit) {
      lines.push('**Re-runs on message edit** yes');
    }

    const prefixAliases = this.findPrefixAliases(command);
    if (prefixAliases.length > 0) {
      const formatted = prefixAliases.map((p) => `\`${p}\``).join(', ');
      lines.push(`**Prefix shortcuts** ${formatted}`);
    }

    if (command.slash) {
      const slashLines = HelpCommand.formatSlashSection(command, prefix);
      if (slashLines.length > 0) {
        lines.push('');
        lines.push('**Slash command**');
        lines.push(...slashLines);
      }
    }

    return new EmbedBuilder()
      .setTitle(`${prefix}${command.name}`)
      .setDescription(lines.join('\n'))
      .setColor(0x5865f2);
  }

  private findPrefixAliases(command: ICommand): string[] {
    const map = this.config.getOrDefault<Record<string, string>>('bot.aliasPrefixes', {});
    const names = new Set<string>([command.name, ...command.aliases]);
    return Object.entries(map)
      .filter(([, target]) => names.has(target))
      .map(([p]) => p);
  }

  private static formatSlashSection(command: ICommand, prefix: string): string[] {
    const out: string[] = [];
    const slash = command.slash!;
    const baseName = `/${command.name}`;
    const aliasNames = (slash.slashAliases ?? []).map((a) => `/${a}`);
    if (aliasNames.length > 0) {
      out.push(`Aliases ${aliasNames.map((n) => `\`${n}\``).join(', ')}`);
    }

    const opts = slash.options ?? [];
    if (opts.length === 0) {
      out.push(`Invoke with \`${baseName}\` (no options).`);
      return out;
    }

    const optLines = opts.map((o) => `• ${HelpCommand.formatOption(o)}`);
    out.push(`Options:`);
    out.push(...optLines);
    void prefix;
    return out;
  }

  private static formatOption(opt: SlashOption): string {
    const required = opt.required ? '**required**' : 'optional';
    const constraints: string[] = [];
    if (opt.type === 'string') {
      if (opt.minLength !== undefined) constraints.push(`min ${opt.minLength}`);
      if (opt.maxLength !== undefined) constraints.push(`max ${opt.maxLength}`);
      if (opt.choices && opt.choices.length > 0) {
        constraints.push(`choices: ${opt.choices.map((c) => c.name).join(', ')}`);
      }
    } else if (opt.type === 'integer') {
      if (opt.minValue !== undefined) constraints.push(`min ${opt.minValue}`);
      if (opt.maxValue !== undefined) constraints.push(`max ${opt.maxValue}`);
    }
    const cstr = constraints.length > 0 ? ` [${constraints.join(', ')}]` : '';
    return `\`${opt.name}\` (${opt.type}, ${required})${cstr} — ${opt.description}`;
  }
}
