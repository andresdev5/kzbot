import { injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';

@injectable()
export class PingCommand extends BaseCommand {
  readonly name = 'ping';
  readonly aliases = ['pong'];
  readonly description = 'Replies with pong and the websocket latency';
  readonly category = CommandCategory.Utility;
  readonly usage = 'ping';
  readonly slash: SlashCommandConfig = {};

  async execute(ctx: CommandContext): Promise<void> {
    const latency = Math.round(ctx.client.ws.ping);
    await ctx.reply(`Pong! Latency: ${latency}ms`);
  }
}
