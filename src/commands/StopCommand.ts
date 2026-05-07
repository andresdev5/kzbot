import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { VoiceManager } from '../core/VoiceManager';

@injectable()
export class StopCommand extends BaseCommand {
  readonly name = 'stop';
  readonly aliases = ['shutup', 'callate', 'silence'];
  readonly description = 'Stops the current playback without leaving the voice channel';
  readonly category = CommandCategory.Voice;
  readonly usage = 'stop';
  readonly slash: SlashCommandConfig = {};

  constructor(@inject(VoiceManager) private readonly voice: VoiceManager) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    if (!ctx.guildId) {
      await ctx.reply('Voice commands only work in servers.');
      return;
    }
    const stopped = this.voice.stop(ctx.guildId);
    await ctx.reply(stopped ? 'Stopped.' : 'Nothing is playing.');
  }
}
