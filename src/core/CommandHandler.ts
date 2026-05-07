import { Client, Message } from 'discord.js';
import { container, inject, injectable } from 'tsyringe';
import { ICommand } from '../commands/ICommand';
import { Config } from './Config';

export const COMMAND_TOKEN = Symbol.for('ICommand');

interface Dispatch {
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

  constructor(@inject(Config) private readonly config: Config) {}

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

  async handle(client: Client, message: Message): Promise<void> {
    if (message.author.bot || !message.content) return;

    const dispatch = this.matchPrefix(message.content) ?? this.matchAliasPrefix(message.content);
    if (!dispatch) return;

    try {
      await dispatch.command.execute({
        client,
        message,
        args: dispatch.args,
        rawArgs: dispatch.rawArgs,
        prefix: dispatch.prefix,
        invokedName: dispatch.invokedName,
      });
    } catch (err) {
      console.error(`Error executing command "${dispatch.command.name}":`, err);
      await message.reply('There was an error executing that command.').catch(() => undefined);
    }
  }

  private matchPrefix(content: string): Dispatch | null {
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

  private matchAliasPrefix(content: string): Dispatch | null {
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
