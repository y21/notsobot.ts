import { Command } from 'detritus-client';

import { CommandTypes } from '../../constants';
import { BaseCommand } from '../basecommand';


export interface CommandArgsBefore {
  
}

export interface CommandArgs {

}

export default class SteamEmojiCommand extends BaseCommand {
  name = 'steamemoji';

  aliases = ['se'];
  metadata = {
    type: CommandTypes.FUN,
  };

  run(context: Command.Context, args: CommandArgs) {

  }
}
