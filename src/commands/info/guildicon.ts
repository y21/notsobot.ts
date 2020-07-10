import { Collections, Command, Constants, Structures, Utils } from 'detritus-client';
const { Colors } = Constants;
const { Embed } = Utils;

import { CommandTypes } from '../../constants';
import { Parameters } from '../../utils';

import { BaseCommand } from '../basecommand';


export interface CommandArgsBefore {
  payload: {
    channels?: Collections.BaseCollection<string, Structures.Channel>,
    emojis?: Collections.BaseCollection<string, Structures.Emoji>,
    guild: Structures.Guild | null,
    memberCount?: number,
    owner?: Structures.User,
    presenceCount?: number,
    voiceStateCount?: number,
  },
}

export interface CommandArgs {
  payload: {
    channels: Collections.BaseCollection<string, Structures.Channel>,
    emojis: Collections.BaseCollection<string, Structures.Emoji>,
    guild: Structures.Guild,
    memberCount: number,
    owner: Structures.User,
    presenceCount: number,
    voiceStateCount: number,
  },
}

export default class GuildIconCommand extends BaseCommand {
  name = 'guildicon';

  label = 'payload';
  metadata = {
    description: 'Get the icon for a guild, defaults to the current guild',
    examples: [
      'guildicon',
      'guildicon 178313653177548800',
    ],
    type: CommandTypes.INFO,
    usage: 'guildicon ?<id>',
  };
  type = Parameters.guildMetadata;

  onBeforeRun(context: Command.Context, args: CommandArgsBefore) {
    return !!args.payload.guild;
  }

  onCancelRun(context: Command.Context, args: CommandArgsBefore) {
    return context.editOrReply('⚠ Unable to find that guild.');
  }

  async run(context: Command.Context, args: CommandArgs) {
    const { guild } = args.payload;
    if (guild.icon) {
      const url = <string> guild.iconUrlFormat(null, {size: 512});

      const channel = context.channel;
      if (channel && channel.canEmbedLinks) {
        const embed = new Embed();
        embed.setAuthor(guild.name, url, guild.jumpLink);
        embed.setColor(Colors.BLURPLE);
        embed.setDescription(`[**Icon Url**](${guild.iconUrl})`);
        embed.setImage(url);

        return context.editOrReply({embed});
      }
      return context.editOrReply(url);
    }
    return context.editOrReply('Guild doesn\'t have an icon.');
  }
}
