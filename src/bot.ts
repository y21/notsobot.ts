import './bootstrap';
import * as Sentry from '@sentry/node';

import { ClusterClient, ShardClient } from 'detritus-client';
import { ActivityTypes, PresenceStatuses, SocketStates } from 'detritus-client/lib/constants';
import { Timers } from 'detritus-utils';

import { NotSoClient } from './client';
import { connectAllStores } from './stores';


if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
  });
}

const bot = new NotSoClient({
  activateOnEdits: true,
  directory: './commands',
  gateway: {
    identifyProperties: {
      $browser: 'Discord iOS',
    },
    loadAllMembers: true,
    presence: {
      activity: {
        name: 'for .',
        type: ActivityTypes.WATCHING,
      },
      status: PresenceStatuses.ONLINE,
    },
  },
  mentionsEnabled: false,
  prefix: '..',
  ratelimits: [
    {duration: 60000, limit: 50, type: 'guild'},
    {duration: 5000, limit: 10, type: 'channel'},
  ],
  useClusterClient: true,
});


bot.on('commandRatelimit', async ({command, context, global, ratelimits}) => {
  if (context.message.canReply) {
    let replied: boolean = false;
    for (const {item, ratelimit, remaining} of ratelimits) {
      if (remaining < 1000 || replied || item.replied) {
        item.replied = true;
        continue;
      }
      replied = item.replied = true;

      let noun: string = 'You idiots are';
      switch (ratelimit.type) {
        case 'channel': {
          noun = 'This guild is';
        }; break;
        case 'guild': {
          noun = 'This channel is';
        }; break;
        case 'user': {
          noun = 'You are';
        }; break;
      }

      let content: string;
      if (global) {
        content = `${noun} using commands WAY too fast, wait ${(remaining / 1000).toFixed(1)} seconds.`;
      } else {
        content = `${noun} using ${command.name} too fast, wait ${(remaining / 1000).toFixed(1)} seconds.`;
      }

      try {
        const message = await context.reply(content);
        await Timers.sleep(Math.max(remaining / 2, 1000));
        item.replied = false;
        if (!message.deleted) {
          await message.delete();
        }
      } catch(e) {
        item.replied = false;
      }
    }
  }
});

bot.on('commandRan', async ({command, context}) => {
  // log channelId, command.name, content, messageId, context.metadata.referenceId, userId
});

bot.on('commandRunError', async ({command, context}) => {
  // log channelId, command.name, content, messageId, context.metadata.referenceId, userId, error
});

(async () => {
  const cluster = <ClusterClient> bot.client;
  if (cluster.manager) {
    process.title = `C: ${cluster.manager.clusterId}, S:(${cluster.shardStart}-${cluster.shardEnd})`;
  } else {
    process.title = `S:(${cluster.shardStart}-${cluster.shardEnd})`;
  }
  connectAllStores(cluster);

  cluster.on('restResponse', async ({response, restRequest, shard}) => {
    const route = response.request.route;
    if (route) {
      if (response.ok) {
        console.log(`Shard #${shard.shardId}: (OK) ${response.statusCode} ${response.request.method}-${response.request.url} (${route.path})`);
      } else {
        const message = `Shard #${shard.shardId}: (NOT OK) ${response.statusCode} ${response.request.method}-${response.request.url} (${route.path})`;
        console.log(message);
        console.log(await response.text());
        Sentry.captureException(new Error(message));
      }
    }
  });

  cluster.on('shard', ({shard}) => {
    const shardId = shard.shardId;
    console.log(`Loading up ${shardId}...`);
    shard.gateway.on('state', ({state}) => {
      const message = `Shard #${shardId} - ${state}`;
      console.log(message);
      if (state === SocketStates.IDENTIFYING) {
        Sentry.captureMessage(message, Sentry.Severity.Log);
      }
    });
    shard.gateway.on('close', ({code, reason}) => {
      const message = `Shard #${shardId} closed - ${code}, ${reason}`;
      console.log(message);
      Sentry.captureMessage(message, Sentry.Severity.Debug);
    });

    /*
    const now = Date.now();
    const send = <any> shard.gateway.send;
    shard.gateway.send = function () {
      console.log(Date.now() - now, 'SEND', ...arguments);
      return send.call(shard.gateway, ...arguments);
    };
    shard.gateway.on('packet', (packet) => {
      console.log(Date.now() - now, 'RECEIVED', packet.s, packet.op, packet.t);
    });
    */
  });

  cluster.on('warn', ({error}) => {
    Sentry.captureException(error);
  });

  try {
    await bot.run();
    console.log(`Shards #(${cluster.shards.map((shard: ShardClient) => shard.shardId).join(', ')}) loaded`);
  } catch(error) {
    console.log(error);
    console.log(error.errors);
  }
})();
