import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { VoiceManager } from '../core/VoiceManager';

@injectable()
export class LeaveCommand extends BaseCommand {
  readonly name = 'leave';
  readonly aliases = ['stop', 'dc', 'disconnect', 'fuera'];
  readonly description = 'Disconnects the bot from the current voice channel';
  readonly category = CommandCategory.Voice;
  readonly usage = 'leave';

  constructor(@inject(VoiceManager) private readonly voice: VoiceManager) {
    super();
  }

  async execute({ message }: CommandContext): Promise<void> {
    if (!message.guildId) {
      await message.reply('Voice commands only work in servers.');
      return;
    }

    const left = this.voice.leave(message.guildId);
    await message.reply(left ? 'Disconnected.' : 'I am not in a voice channel.');
  }
}
