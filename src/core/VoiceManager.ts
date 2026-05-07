import {
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice';
import { VoiceBasedChannel, VoiceState } from 'discord.js';
import { injectable } from 'tsyringe';

@injectable()
export class VoiceManager {
  private readonly players = new Map<string, AudioPlayer>();

  async play(channel: VoiceBasedChannel, filePath: string): Promise<void> {
    const connection = await this.ensureConnection(channel);
    const player = this.ensurePlayer(channel.guild.id);
    connection.subscribe(player);

    const resource = createAudioResource(filePath, { inputType: StreamType.Arbitrary });
    player.play(resource);
    await entersState(player, AudioPlayerStatus.Playing, 15_000);
  }

  leave(guildId: string): boolean {
    const connection = getVoiceConnection(guildId);
    const player = this.players.get(guildId);
    player?.stop(true);
    this.players.delete(guildId);
    if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
      return true;
    }
    return false;
  }

  isConnected(guildId: string): boolean {
    const conn = getVoiceConnection(guildId);
    return !!conn && conn.state.status !== VoiceConnectionStatus.Destroyed;
  }

  handleVoiceStateUpdate(_oldState: VoiceState, newState: VoiceState): void {
    const guildId = newState.guild.id;
    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    const channelId = connection.joinConfig.channelId;
    if (!channelId) return;

    const channel = newState.guild.channels.cache.get(channelId);
    if (!channel || !channel.isVoiceBased()) return;

    const humans = channel.members.filter((m) => !m.user.bot);
    if (humans.size === 0) {
      console.log(`[voice] no humans in #${channel.name}, disconnecting`);
      this.leave(guildId);
    }
  }

  private async ensureConnection(channel: VoiceBasedChannel): Promise<VoiceConnection> {
    const existing = getVoiceConnection(channel.guild.id);
    if (
      existing &&
      existing.state.status !== VoiceConnectionStatus.Destroyed &&
      existing.joinConfig.channelId === channel.id
    ) {
      if (existing.state.status === VoiceConnectionStatus.Ready) return existing;
      await entersState(existing, VoiceConnectionStatus.Ready, 20_000);
      return existing;
    }

    if (existing) {
      this.leave(channel.guild.id);
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    connection.on('stateChange', (oldS, newS) => {
      console.debug(
        `[voice] connection (${channel.guild.id}): ${oldS.status} -> ${newS.status}`,
      );
      if (newS.status === VoiceConnectionStatus.Destroyed) {
        this.players.get(channel.guild.id)?.stop(true);
        this.players.delete(channel.guild.id);
      }
    });
    connection.on('error', (err) => console.error('[voice error]', err));

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    return connection;
  }

  private ensurePlayer(guildId: string): AudioPlayer {
    const existing = this.players.get(guildId);
    if (existing) return existing;

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    player.on('error', (err) => console.error('[voice player error]', err));
    this.players.set(guildId, player);
    return player;
  }
}
