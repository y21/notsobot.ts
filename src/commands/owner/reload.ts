import { ClusterClient, Command, CommandClient, ShardClient } from 'detritus-client';

import { NotSoClient } from '../../client';
import { CommandTypes } from '../../constants';

import { BaseCommand } from '../basecommand';


export interface CommandArgs {
  stores: boolean,
}

export default class ReloadCommand extends BaseCommand {
  aliases = ['refresh'];
  name = 'reload';

  metadata = {
    description: 'Reload the bot\'s commands.',
    examples: ['refresh', 'refresh -stores'],
    type: CommandTypes.OWNER,
    usage: 'refresh',
  };
  responseOptional = true;

  constructor(client: CommandClient, options: Command.CommandOptions) {
    super(client, {
      ...options,
      args: [{name: 'stores', type: Boolean}],
    });
  }

  onBefore(context: Command.Context) {
    return context.user.isClientOwner;
  }

  async run(context: Command.Context, args: CommandArgs) {
    if (!context.manager) {
      return context.editOrReply('no cluster manager found');
    }
    const message = await context.editOrReply('ok, refreshing...');
    const shardIds = await context.manager.broadcastEval(async (cluster: ClusterClient, refreshStores: boolean) => {
      const LIB_PATH = 'notsobot.ts/lib';
      const STORE_PATH = '/stores/';

      const IGNORE = ['/bot.', '/redis.'];

      for (let key in require.cache) {
        if (!key.includes(LIB_PATH)) {
          continue;
        }
        if (IGNORE.some((file) => key.includes(file))) {
          continue;
        }

        if (key.includes(STORE_PATH)) {
          if (!refreshStores) {
            continue;
          }
          const store = require(key);
          if (store && store.default) {
            store.default.stop(cluster);
          }
        }
        delete require.cache[key];
      }
      if (cluster.commandClient) {
        const commandClient = <NotSoClient> cluster.commandClient;
        await commandClient.resetCommands();
      }
      for (let key in require.cache) {
        if (!key.includes(LIB_PATH)) {
          continue;
        }

        if (key.includes(STORE_PATH)) {
          if (!refreshStores) {
            continue;
          }
          const store = require(key);
          if (store.default) {
            store.default.connect(cluster);
          }
        }
      }
      return cluster.shards.map((shard: ShardClient) => shard.shardId);
    }, args.stores);

    const error = shardIds.find((shardId: any) => shardId instanceof Error);
    if (error) {
      if (error.errors) {
        return message.edit(`${error.message} (${JSON.stringify(error.errors)})`);
      }
      return message.edit(`Error: ${error.message}`);
    }
    return message.edit(`ok, refreshed commands on ${JSON.stringify(shardIds)}`);
  }
}
