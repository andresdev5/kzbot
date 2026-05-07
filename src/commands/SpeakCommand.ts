import { ChannelType, GuildMember } from 'discord.js';
import { inject, injectable } from 'tsyringe';
import { BaseCommand } from './BaseCommand';
import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { PollyService } from '../core/PollyService';
import { VoiceManager } from '../core/VoiceManager';
import { findVoice } from '../models/VoiceCatalog';
import { PollyVoice } from '../enums/PollyVoice';

interface ParsedSpeakArgs {
  voice?: PollyVoice;
  voiceToken?: string;
  text: string;
}

@injectable()
export class SpeakCommand extends BaseCommand {
  readonly name = 'speak';
  readonly aliases = ['say', 'tts'];
  readonly description = 'Joins your voice channel and speaks the given text using AWS Polly';
  readonly category = CommandCategory.Voice;
  readonly usage = 'speak [:VoiceName] <text>';

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

    const parsed = SpeakCommand.parseArgs(rawArgs);
    if (parsed.voiceToken && !parsed.voice) {
      await message.reply(
        `Unknown voice \`${parsed.voiceToken}\`. Use \`voices\` to see the available list.`,
      );
      return;
    }
    if (!parsed.text) {
      await message.reply('Provide some text to speak after the voice.');
      return;
    }

    const member = message.member as GuildMember | null;
    const channel = member?.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await message.reply('You must be in a voice channel.');
      return;
    }

    const { filePath, cached, voice } = await this.polly.synthesizeToFile({
      text: parsed.text,
      voice: parsed.voice,
    });
    console.debug(
      `[polly] ${cached ? 'cache hit' : 'cache miss'} (${voice}): ${filePath}`,
    );

    try {
      await this.voice.play(channel, filePath);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await message.reply(`Voice playback failed: ${reason}`).catch(() => undefined);
      throw err;
    }
  }

  private static parseArgs(raw: string): ParsedSpeakArgs {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(':')) {
      return { text: trimmed };
    }
    const rest = trimmed.slice(1);
    const spaceIdx = rest.search(/\s/);
    const token = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
    const text = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
    const found = findVoice(token);
    return { voice: found?.id, voiceToken: token, text };
  }
}
