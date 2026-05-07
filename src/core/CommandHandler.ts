import { Client, Message } from 'discord.js';
import { container, inject, injectable } from 'tsyringe';
import { ICommand } from '../commands/ICommand';
import { Config } from './Config';

export const COMMAND_TOKEN = Symbol.for('ICommand');

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

    const prefix = this.config.get<string>('bot.prefix');
    if (!message.content.startsWith(prefix)) return;

    const withoutPrefix = message.content.slice(prefix.length).trimStart();
    if (!withoutPrefix) return;

    const [invokedName, ...args] = withoutPrefix.split(/\s+/);
    const command = this.resolve(invokedName.toLowerCase());
    if (!command) return;

    const rawArgs = withoutPrefix.slice(invokedName.length).trim();

    try {
      await command.execute({
        client,
        message,
        args,
        rawArgs,
        prefix,
        invokedName,
      });
    } catch (err) {
      console.error(`Error executing command "${command.name}":`, err);
      await message.reply('There was an error executing that command.').catch(() => undefined);
    }
  }
}
