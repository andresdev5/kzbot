import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  StreamType,
} from '@discordjs/voice';
import { ChannelType, GuildMember } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { PollyService } from '../core/PollyService';

@injectable()
export class SpeakCommand extends BaseCommand {
  readonly name = 'speak';
  readonly aliases = ['say', 'tts'];
  readonly description = 'Joins your voice channel and speaks the given text using AWS Polly';
  readonly category = CommandCategory.Voice;
  readonly usage = 'speak <text>';

  constructor(@inject(PollyService) private readonly polly: PollyService) {
    super();
  }

  async execute({ message, rawArgs }: CommandContext): Promise<void> {
    if (!rawArgs) {
      await message.reply('Provide some text to speak.');
      return;
    }

    const member = message.member as GuildMember | null;
    const voiceChannel = member?.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await message.reply('You must be in a voice channel.');
      return;
    }

    const audioStream = await this.polly.synthesize({ text: rawArgs });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

      const player = createAudioPlayer();
      const resource = createAudioResource(audioStream, { inputType: StreamType.Arbitrary });

      connection.subscribe(player);
      player.play(resource);

      await entersState(player, AudioPlayerStatus.Playing, 10_000);
      await entersState(player, AudioPlayerStatus.Idle, 10 * 60_000);
    } finally {
      connection.destroy();
    }
  }
}
