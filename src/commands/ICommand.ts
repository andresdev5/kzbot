import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';

export interface ICommand {
  readonly name: string;
  readonly aliases: string[];
  readonly description: string;
  readonly category: CommandCategory;
  readonly usage?: string;

  execute(context: CommandContext): Promise<void>;
}
