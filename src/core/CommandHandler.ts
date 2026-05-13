import {
  ChatInputCommandInteraction,
  Client,
  Message,
  PartialMessage,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { container, inject, injectable } from 'tsyringe';
import { ICommand } from '../commands/ICommand';
import { CommandContext } from '../models/CommandContext';
import { Config } from './Config';
import { Logger } from './Logger';
import { buildSlashCommands } from './SlashBuilder';

export const COMMAND_TOKEN = Symbol.for('ICommand');

interface PrefixDispatch {
  command: ICommand;
  prefix: string;
  invokedName: string;
  args: string[];
  rawArgs: string;
}

@injectable()
export class CommandHandler {
  private readonly commands = new Map<string, ICommand>();
  private readonly aliases = new Map<string, string>();

  constructor(
    @inject(Config) private readonly config: Config,
    @inject(Logger) private readonly logger: Logger,
  ) {}

  registerAll(): void {
    const registered = container.isRegistered(COMMAND_TOKEN)
      ? container.resolveAll<ICommand>(COMMAND_TOKEN)
      : [];

    for (const command of registered) {
      this.register(command);
    }
  }

  register(command: ICommand): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Duplicate command name: ${command.name}`);
    }
    this.commands.set(command.name, command);
    for (const alias of command.aliases) {
      if (this.aliases.has(alias)) {
        throw new Error(`Duplicate command alias: ${alias}`);
      }
      this.aliases.set(alias, command.name);
    }
  }

  list(): ICommand[] {
    return Array.from(this.commands.values());
  }

  resolve(name: string): ICommand | undefined {
    const direct = this.commands.get(name);
    if (direct) return direct;
    const aliased = this.aliases.get(name);
    return aliased ? this.commands.get(aliased) : undefined;
  }

  buildSlashJson(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    const result: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    for (const command of this.commands.values()) {
      for (const builder of buildSlashCommands(command)) {
        result.push(builder.toJSON());
      }
    }
    return result;
  }

  async handle(client: Client, message: Message): Promise<void> {
    if (message.author.bot) return;
    this.logger.debug(
      `[msg] from=${message.author.tag} guild=${message.guildId ?? 'dm'} contentLen=${message.content.length} content=${JSON.stringify(message.content)}`,
    );
    if (!message.content) return;

    const dispatch =
      this.matchPrefix(message.content) ?? this.matchAliasPrefix(message.content);
    if (!dispatch) {
      this.logger.debug(
        `[msg] no dispatch matched. prefix=${JSON.stringify(this.config.get('bot.prefix'))} aliasPrefixes=${JSON.stringify(this.config.getOrDefault('bot.aliasPrefixes', {}))}`,
      );
      return;
    }
    this.logger.debug(
      `[msg] dispatching command=${dispatch.command.name} via prefix=${JSON.stringify(dispatch.prefix)}`,
    );

    const ctx = CommandContext.fromMessage(
      client,
      message,
      dispatch.args,
      dispatch.rawArgs,
      dispatch.prefix,
      dispatch.invokedName,
    );

    await this.run(dispatch.command, ctx);
  }

  async handleInteraction(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.resolve(interaction.commandName);
    if (!command) return;
    const ctx = CommandContext.fromInteraction(client, interaction);
    await this.run(command, ctx);
  }

  async handleEdit(
    client: Client,
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
  ): Promise<void> {
    let resolved: Message;
    if (newMessage.partial) {
      try {
        resolved = await newMessage.fetch();
      } catch {
        return;
      }
    } else {
      resolved = newMessage;
    }

    if (resolved.author?.bot) return;
    if (!resolved.content) return;
    if (!oldMessage.partial && oldMessage.content === resolved.content) return;

    const dispatch =
      this.matchPrefix(resolved.content) ?? this.matchAliasPrefix(resolved.content);
    if (!dispatch) return;

    if (!dispatch.command.runOnEdit) {
      this.logger.debug(
        `[edit] command "${dispatch.command.name}" does not opt-in to runOnEdit, skipping`,
      );
      return;
    }

    this.logger.debug(
      `[edit] dispatching command=${dispatch.command.name} via prefix=${JSON.stringify(dispatch.prefix)}`,
    );

    const ctx = CommandContext.fromMessage(
      client,
      resolved,
      dispatch.args,
      dispatch.rawArgs,
      dispatch.prefix,
      dispatch.invokedName,
    );

    await this.run(dispatch.command, ctx);
  }

  private async run(command: ICommand, ctx: CommandContext): Promise<void> {
    try {
      await command.execute(ctx);
    } catch (err) {
      this.logger.error(`Error executing command "${command.name}":`, err);
      await ctx.reply('There was an error executing that command.').catch(() => undefined);
    }
  }

  private matchPrefix(content: string): PrefixDispatch | null {
    const prefix = this.config.get<string>('bot.prefix');
    if (!content.startsWith(prefix)) return null;

    const withoutPrefix = content.slice(prefix.length).trimStart();
    if (!withoutPrefix) return null;

    const parts = withoutPrefix.split(/\s+/);
    const invokedName = parts[0];
    const command = this.resolve(invokedName.toLowerCase());
    if (!command) return null;

    const rawArgs = withoutPrefix.slice(invokedName.length).trim();
    const args = rawArgs ? rawArgs.split(/\s+/) : [];
    return { command, prefix, invokedName, args, rawArgs };
  }

  private matchAliasPrefix(content: string): PrefixDispatch | null {
    const aliasPrefixes = this.config.getOrDefault<Record<string, string>>(
      'bot.aliasPrefixes',
      {},
    );

    const sorted = Object.keys(aliasPrefixes).sort((a, b) => b.length - a.length);
    for (const prefix of sorted) {
      if (!content.startsWith(prefix)) continue;
      const command = this.resolve(aliasPrefixes[prefix]);
      if (!command) continue;
      const rawArgs = content.slice(prefix.length).trim();
      const args = rawArgs ? rawArgs.split(/\s+/) : [];
      return { command, prefix, invokedName: command.name, args, rawArgs };
    }
    return null;
  }
}
