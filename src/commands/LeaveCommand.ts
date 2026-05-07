import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { VoiceManager } from '../core/VoiceManager';

@injectable()
export class LeaveCommand extends BaseCommand {
  readonly name = 'leave';
  readonly aliases = ['stop', 'dc', 'disconnect', 'fuera'];
  readonly description = 'Disconnects the bot from the current voice channel';
  readonly category = CommandCategory.Voice;
  readonly usage = 'leave';
  readonly slash: SlashCommandConfig = {
    slashAliases: ['stop'],
  };

  constructor(@inject(VoiceManager) private readonly voice: VoiceManager) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    if (!ctx.guildId) {
      await ctx.reply('Voice commands only work in servers.');
      return;
    }
    const left = this.voice.leave(ctx.guildId);
    await ctx.reply(left ? 'Disconnected.' : 'I am not in a voice channel.');
  }
}
