import { ChannelType, GuildMember } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { PollyService } from '../core/PollyService';
import { VoiceManager } from '../core/VoiceManager';

@injectable()
export class SpeakCommand extends BaseCommand {
  readonly name = 'speak';
  readonly aliases = ['say', 'tts'];
  readonly description = 'Joins your voice channel and speaks the given text using AWS Polly';
  readonly category = CommandCategory.Voice;
  readonly usage = 'speak <text>';

  constructor(
    @inject(PollyService) private readonly polly: PollyService,
    @inject(VoiceManager) private readonly voice: VoiceManager,
  ) {
    super();
  }

  async execute({ message, rawArgs }: CommandContext): Promise<void> {
    if (!rawArgs) {
      await message.reply('Provide some text to speak.');
      return;
    }

    const member = message.member as GuildMember | null;
    const channel = member?.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await message.reply('You must be in a voice channel.');
      return;
    }

    const { filePath, cached } = await this.polly.synthesizeToFile({ text: rawArgs });
    console.debug(`[polly] ${cached ? 'cache hit' : 'cache miss'}: ${filePath}`);

    try {
      await this.voice.play(channel, filePath);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await message.reply(`Voice playback failed: ${reason}`).catch(() => undefined);
      throw err;
    }
  }
}
