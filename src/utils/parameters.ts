import {
  Command,
  Collections,
  Constants,
  Structures,
  Utils,
} from 'detritus-client';
import { Endpoints } from 'detritus-client-rest';

const { DiscordRegexNames } = Constants;

import GuildStore, { GuildStorePayload } from '../stores/guild';
import {
  findMembers,
  findMemberByUsername,
  isSnowflake,
} from './tools';


export async function getImageUrl(
  value: string,
  context: Command.Context,
): Promise<boolean | null | string> {
  value = value.trim();

  try {
    if (value) {
      let match = Utils.regex(DiscordRegexNames.MENTION_USER, value);
      if (match) {
        const { id } = match;
        const userId = <string> id;
        if (isSnowflake(userId)) {
          let user: Structures.User;
          if (context.message.mentions.has(userId)) {
            user = <Structures.Member | Structures.User> context.message.mentions.get(userId);
          } else {
            user = await context.rest.fetchUser(userId);
          }
          return user.avatarUrlFormat(null, {size: 1024});
        }
      }

      match = Utils.regex(DiscordRegexNames.TEXT_SNOWFLAKE, value);
      if (match) {
        const { text } = match;
        const userId = <string> text;
        if (isSnowflake(userId)) {
          if (context.guildId) {
            let member: Structures.Member | undefined;
            if (context.members.has(context.guildId, userId)) {
              member = <Structures.Member> context.members.get(context.guildId, userId);
            } else {
              const event = await findMembers(context, {userIds: [userId]});
              if (event && event.members) {
                member = event.members.find((member) => member.id === userId);
              }
            }
            if (member) {
              return member.avatarUrlFormat(null, {size: 1024});
            }
          }
          let user: Structures.User;
          if (context.users.has(userId)) {
            user = <Structures.User> context.users.get(userId);
          } else {
            user = await context.rest.fetchUser(userId);
          }
          return user.avatarUrlFormat(null, {size: 1024});
        }
      }

      match = Utils.regex(DiscordRegexNames.EMOJI, value);
      if (match) {
        const { animated, id } = match;
        const format = (animated) ? 'gif' : 'png';
        return Endpoints.CDN.URL + Endpoints.CDN.EMOJI(id, format);
      }

      match = Utils.regex(DiscordRegexNames.TEXT_URL, value);
      if (match) {
        const { text } = match;
        return <string> text;
      }

      // guild member chunk or search cache
      const nameParts = value.split('#');
      const username = (<string> nameParts.shift()).toLowerCase().slice(0, 32);
      let discriminator: null | string = null;
      if (nameParts.length) {
        discriminator = (<string> nameParts.shift()).padStart(4, '0');
      }

      const voiceChannel = (context.member) ? context.member.voiceChannel : null;
      if (voiceChannel) {
        const members = voiceChannel.members;
        if (members) {
          const found = findMemberByUsername(members, username, discriminator);
          if (found) {
            return found.avatarUrlFormat(null, {size: 1024});
          }
        }
      }

      const channel = context.channel;
      if (channel) {
        const messages = channel.messages;
        if (messages) {
          for (let [messageId, message] of messages) {
            const members = [message.member, message.author].filter((v) => v);
            if (members.length) {
              const found = findMemberByUsername(members, username, discriminator);
              if (found) {
                return found.avatarUrlFormat(null, {size: 1024});
              }
            }
            if (message.mentions.length) {
              const found = findMemberByUsername(message.mentions, username, discriminator);
              if (found) {
                return found.avatarUrlFormat(null, {size: 1024});
              }
            }
          }
        }
        const members = channel.members;
        if (members) {
          const found = findMemberByUsername(members, username, discriminator);
          if (found) {
            return found.avatarUrlFormat(null, {size: 1024});
          }
        }
      }

      if (context.guildId) {
        // members chunk
        const guild = context.guild;
        const members = (guild) ? guild.members : null;
        if (members) {
          const found = findMemberByUsername(members, username, discriminator);
          if (found) {
            return found.avatarUrlFormat(null, {size: 1024});
          }
        }

        // fall back to chunk request
        const event = await findMembers(context, {query: username});
        if (event && event.members) {
          const found = event.members.find((member: Structures.Member) => {
            return (discriminator) ? member.discriminator === discriminator : true;
          });
          if (found) {
            return found.avatarUrlFormat(null, {size: 1024});
          }
        }
      } else {
        // check our users cache since this is from a dm...
        const found = context.users.find((user) => {
          const name = user.username.toLowerCase();
          if (name.startsWith(username)) {
            return (discriminator) ? user.discriminator === discriminator : true;
          }
          return false;
        });
        if (found) {
          return found.avatarUrlFormat(null, {size: 1024});
        }
      }

      return null;
    } else {
      if (context.message.attachments.length) {
        const attachment = context.message.attachments.find((attachment) => attachment.isImage);
        if (attachment && attachment.proxyUrl) {
          return attachment.proxyUrl;
        }
      }
    }
  } catch(error) {
    console.error(error);
  }

  // this tells us that nothing was provided
  return false;
}

export async function applications(
  value: string,
  context: Command.Context,
): Promise<Array<Structures.Application> | undefined> {
  value = value.trim().toLowerCase();
  if (value) {
    if (isSnowflake(value) && context.applications.has(value)) {
      const application = <Structures.Application> context.applications.get(value);
      return [application];
    }
    return context.applications.filter((application) => {
      if (application.name.toLowerCase().startsWith(value)) {
        return true;
      }
      if (application.aliases) {
        return application.aliases.some((name) => {
          return name.toLowerCase().startsWith(value);
        });
      }
      return false;
    });
  }
}

export async function channel(
  value: string,
  context: Command.Context,
): Promise<null | Structures.Channel | undefined> {
  value = value.trim();
  if (value) {
    if (isSnowflake(value)) {
      return context.channels.get(value);
    }
    return null;
  }
  return context.channel;
}

export async function guild(
  value: string,
  context: Command.Context,
): Promise<null | Structures.Guild | undefined> {
  value = value.trim();
  if (value) {
    if (isSnowflake(value)) {
      return context.guilds.get(value);
    }
    return null;
  }
  return context.guild;
}

export async function guildAndEmojis(
  value: string,
  context: Command.Context,
): Promise<GuildStorePayload> {
  const guildId = value.trim() || context.guildId;

  const payload: GuildStorePayload = {
    channels: null,
    emojis: null,
    memberCount: 0,
    presenceCount: 0,
    voiceStateCount: 0,
  };
  if (!guildId) {
    return payload;
  }

  if (GuildStore.has(guildId)) {
    return <GuildStorePayload> GuildStore.get(guildId);
  }

  try {
    if (isSnowflake(guildId)) {
      try {
        if (context.guilds.has(guildId)) {
          payload.guild = await context.rest.fetchGuild(guildId);
          payload.channels = payload.guild.channels;
          payload.memberCount = payload.guild.memberCount;
          payload.presenceCount = payload.guild.presences.length;
          payload.voiceStateCount = payload.guild.voiceStates.length;
        } else {
          payload.guild = await context.rest.fetchGuild(guildId);
          payload.channels = await payload.guild.fetchChannels();

          if (context.manager) {
            const results = await context.manager.broadcastEval(`((cluster) => {
              const id = '${guildId}';
              const shard = cluster.shards.find((shard) => shard.guilds.has(id));
              if (shard) {
                const guild = shard.guilds.get(id);
                return {
                  memberCount: guild.memberCount,
                  presenceCount: guild.presences.length,
                  voiceStateCount: guild.voiceStates.length,
                };
              }
            })(this)`);
            const result = results.find((result: any) => result);
            if (result) {
              Object.assign(payload, result);
            }
          }
        }
        payload.emojis = payload.guild.emojis;
      } catch(error) {
      }
      GuildStore.set(guildId, payload);
    }
  } catch(error) {
    console.error(error);
    payload.guild = null;
  }
  return payload;
}

export async function memberOrUser(
  value: string,
  context: Command.Context,
): Promise<null | Structures.Member | Structures.User> {
  value = value.trim();

  try {
    if (value) {
      let match = Utils.regex(DiscordRegexNames.MENTION_USER, value);
      if (match) {
        const { id } = match;
        const userId = <string> id;
        if (isSnowflake(userId)) {
          if (context.message.mentions.has(userId)) {
            return <Structures.Member | Structures.User> context.message.mentions.get(userId);
          } else {
            return await context.rest.fetchUser(userId);
          }
        }
      }

      match = Utils.regex(DiscordRegexNames.TEXT_SNOWFLAKE, value);
      if (match) {
        const { text } = match;
        const userId = <string> text;
        if (isSnowflake(userId)) {
          if (context.guildId) {
            if (context.members.has(context.guildId, userId)) {
              return <Structures.Member> context.members.get(context.guildId, userId);
            } else {
              const event = await findMembers(context, {userIds: [userId]});
              if (event && event.members) {
                const found = event.members.find((member) => member.id === userId);
                if (found) {
                  return found;
                }
              }
            }
          }
          if (context.users.has(userId)) {
            return <Structures.User> context.users.get(userId);
          } else {
            return await context.rest.fetchUser(userId);
          }
        }
      }

      // guild member chunk or search cache
      const nameParts = value.split('#');
      const username = (<string> nameParts.shift()).toLowerCase().slice(0, 32);
      let discriminator: null | string = null;
      if (nameParts.length) {
        discriminator = (<string> nameParts.shift()).padStart(4, '0');
      }

      const voiceChannel = context.voiceChannel;
      if (voiceChannel) {
        const members = voiceChannel.members;
        if (members) {
          const found = findMemberByUsername(members, username, discriminator);
          if (found) {
            return found;
          }
        }
      }

      const channel = context.channel;
      if (channel) {
        const messages = channel.messages;
        if (messages) {
          for (let [messageId, message] of messages) {
            const members = [message.member, message.author].filter((v) => v);
            if (members.length) {
              const found = findMemberByUsername(members, username, discriminator);
              if (found) {
                return found;
              }
            }
            if (message.mentions.length) {
              const found = findMemberByUsername(message.mentions, username, discriminator);
              if (found) {
                return found;
              }
            }
          }
        }
        const members = channel.members;
        if (members) {
          const found = findMemberByUsername(members, username, discriminator);
          if (found) {
            return found;
          }
        }
      }

      if (context.guildId) {
        // members chunk
        const guild = context.guild;
        const members = (guild) ? guild.members : null;
        if (members) {
          const found = findMemberByUsername(members, username, discriminator);
          if (found) {
            return found;
          }
        }

        // fall back to chunk request
        const event = await findMembers(context, {query: username});
        if (event && event.members) {
          const found = event.members.find((member: Structures.Member) => {
            return (discriminator) ? member.discriminator === discriminator : true;
          });
          if (found) {
            return found;
          }
        }
      } else {
        // check our users cache since this is from a dm...
        const found = context.users.find((user) => {
          const name = user.username.toLowerCase();
          if (name.startsWith(username)) {
            return (discriminator) ? user.discriminator === discriminator : true;
          }
          return false;
        });
        if (found) {
          return found;
        }
      }
    } else {
      return context.member || context.user;
    }
  } catch(error) {
    console.error(error);
  }
  return null;
}

export function percentage(
  value: string,
  context: Command.Context,
): number {
  value = value.trim().replace(/%/g, '');
  const percentage = parseFloat(value);
  if (isNaN(percentage)) {
    return percentage;
  }
  return Math.max(0, Math.min(percentage / 100));
}
