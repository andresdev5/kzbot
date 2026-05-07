import { container } from 'tsyringe';
import { COMMAND_TOKEN } from '../core/CommandHandler';
import { LeaveCommand } from './LeaveCommand';
import { PingCommand } from './PingCommand';
import { SpeakCommand } from './SpeakCommand';

export function registerCommands(): void {
  container.register(COMMAND_TOKEN, { useClass: PingCommand });
  container.register(COMMAND_TOKEN, { useClass: SpeakCommand });
  container.register(COMMAND_TOKEN, { useClass: LeaveCommand });
}
