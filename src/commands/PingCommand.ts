import { injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';

@injectable()
export class PingCommand extends BaseCommand {
  readonly name = 'ping';
  readonly aliases = ['pong'];
  readonly description = 'Replies with pong and the websocket latency';
  readonly category = CommandCategory.Utility;
  readonly usage = 'ping';

  async execute({ message, client }: CommandContext): Promise<void> {
    const latency = Math.round(client.ws.ping);
    await message.reply(`Pong! Latency: ${latency}ms`);
  }
}
