import { Command, CommandClient } from 'detritus-client';

import { imageManipulationEyes } from '../../../api';
import { CommandTypes, ImageEyeTypes } from '../../../constants';
import { imageReply } from '../../../utils';

import { BaseImageCommand } from '../basecommand';


export interface CommandArgsBefore {
  url?: null | string,
}

export interface CommandArgs {
  url: string,
}

export const COMMAND_NAME = 'eyes googly';

export default class EyesCommand extends BaseImageCommand<CommandArgs> {
  constructor(client: CommandClient) {
    super(client, {
      name: 'googly',
      prefixes: ['eyes ', 'eye '],

      metadata: {
        description: 'Attach googly eyes to people\'s faces in an image',
        examples: [
          COMMAND_NAME,
          `${COMMAND_NAME} https://i.imgur.com/WwiO7Bx.jpg`,
        ],
        type: CommandTypes.IMAGE,
        usage: '?<emoji,user:id|mention|name,url>',
      },
    });
  }

  async run(context: Command.Context, args: CommandArgs) {
    const response = await imageManipulationEyes(context, {
      type: ImageEyeTypes.GOOGLY,
      url: args.url,
    });
    return imageReply(context, response);
  }
}