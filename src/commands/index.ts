import { container } from 'tsyringe';
import { COMMAND_TOKEN } from '../core/CommandHandler';
import { FishCommand } from './FishCommand';
import { FishDefaultCommand } from './FishDefaultCommand';
import { FishIdCommand } from './FishIdCommand';
import { FishIdListCommand } from './FishIdListCommand';
import { FishVoicesCommand } from './FishVoicesCommand';
import { HelpCommand } from './HelpCommand';
import { LeaveCommand } from './LeaveCommand';
import { PingCommand } from './PingCommand';
import { SpeakCommand } from './SpeakCommand';
import { StopCommand } from './StopCommand';
import { VoiceCommand } from './VoiceCommand';
import { VoicesCommand } from './VoicesCommand';

export function registerCommands(): void {
  container.register(COMMAND_TOKEN, { useClass: PingCommand });
  container.register(COMMAND_TOKEN, { useClass: SpeakCommand });
  container.register(COMMAND_TOKEN, { useClass: StopCommand });
  container.register(COMMAND_TOKEN, { useClass: LeaveCommand });
  container.register(COMMAND_TOKEN, { useClass: VoiceCommand });
  container.register(COMMAND_TOKEN, { useClass: VoicesCommand });
  container.register(COMMAND_TOKEN, { useClass: FishCommand });
  container.register(COMMAND_TOKEN, { useClass: FishDefaultCommand });
  container.register(COMMAND_TOKEN, { useClass: FishVoicesCommand });
  container.register(COMMAND_TOKEN, { useClass: FishIdCommand });
  container.register(COMMAND_TOKEN, { useClass: FishIdListCommand });
  container.register(COMMAND_TOKEN, { useClass: HelpCommand });
}
