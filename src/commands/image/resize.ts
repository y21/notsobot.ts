import { Command, CommandClient } from 'detritus-client';

import { imageResize } from '../../api';
import { CommandTypes } from '../../constants';
import { imageReply } from '../../utils';

import { BaseImageCommand } from '../basecommand';


export interface CommandArgsBefore {
  convert?: string,
  scale: number,
  size?: string,
  url?: null | string,
}

export interface CommandArgs {
  convert?: string,
  scale: number,
  size?: string,
  url: string,
}

export default class ResizeCommand extends BaseImageCommand<CommandArgs> {
  name = 'resize';

  aliases = ['enlarge', 'rescale'];
  metadata = {
    examples: [
      'resize',
      'resize cake',
      'resize <@439205512425504771> -convert jpeg',
      'resize 👌🏿 -scale 2',
      'resize https://cdn.notsobot.com/brands/notsobot.png -convert webp -size 2048',
    ],
    type: CommandTypes.IMAGE,
    usage: 'resize ?<emoji|id|mention|name|url> (-convert <format>) (-scale <number>) (-size <number>)',
  };

  constructor(client: CommandClient, options: Command.CommandOptions) {
    super(client, {
      ...options,
      args: [
        {name: 'convert'},
        {default: 2, name: 'scale', type: 'float'},
        {name: 'size'},
      ],
    });
  }

  async run(context: Command.Context, args: CommandArgs) {
    await context.triggerTyping();

    const response = await imageResize(context, {
      convert: args.convert,
      scale: args.scale,
      size: args.size,
      url: args.url,
    });
    return imageReply(context, response, 'magik');
  }
}
