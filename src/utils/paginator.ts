import {
  Command,
  GatewayClientEvents,
  Structures,
  Utils,
} from 'detritus-client';
import { DiscordRegexNames } from 'detritus-client/lib/constants';
import { Timers } from 'detritus-utils';

import PaginatorsStore from '../stores/paginators';

import { editOrReply } from './tools';


export const MAX_PAGE = Number.MAX_SAFE_INTEGER;
export const MIN_PAGE = 1;

export const PageEmojis = Object.freeze({
  custom: '🔢',
  info: 'ℹ',
  next: '➡',
  nextDouble: '⏭',
  previous: '⬅',
  previousDouble: '⏮',
  stop: '⏹',
});

export type OnErrorCallback = (error: any, paginator: Paginator) => Promise<any> | any;
export type OnExpireCallback = (paginator: Paginator) => Promise<any> | any;
export type OnPageCallback = (page: number) => Promise<Utils.Embed> | Utils.Embed;
export type OnPageNumberCallback = (content: string) => Promise<number> | number;

export interface PaginatorEmojis {
  custom?: Structures.Emoji | string,
  info?: Structures.Emoji | string,
  next?: Structures.Emoji | string,
  previous?: Structures.Emoji | string,
  stop?: Structures.Emoji | string,
}

export interface PaginatorOptions {
  emojis?: PaginatorEmojis,
  expire?: number,
  message?: Structures.Message,
  page?: number,
  pageLimit?: number,
  pageSkipAmount?: number,
  pages?: Array<Utils.Embed>,
  targets?: Array<Structures.Member | Structures.User | string>,

  onError?: OnErrorCallback,
  onExpire?: OnExpireCallback,
  onPage?: OnPageCallback,
  onPageNumber?: OnPageNumberCallback,
}

export class Paginator {
  readonly context: Command.Context | Structures.Message;
  readonly custom: {
    expire: number,
    message?: null | Structures.Message,
    timeout: Timers.Timeout,
    userId?: null | string,
  } = {
    expire: 10000,
    timeout: new Timers.Timeout(),
  };
  readonly timeout = new Timers.Timeout();

  emojis: {[key: string]: Structures.Emoji} = {};
  expires: number = 60000;
  isOnGuide: boolean = false;
  message: null | Structures.Message = null;
  page: number = MIN_PAGE;
  pageLimit: number = MAX_PAGE;
  pageSkipAmount: number = 10;
  pages?: Array<Utils.Embed>;
  ratelimit: number = 1500;
  ratelimitTimeout = new Timers.Timeout();
  stopped: boolean = false;
  targets: Array<string> = [];

  onError?: OnErrorCallback;
  onExpire?: OnExpireCallback;
  onPage?: OnPageCallback;
  onPageNumber?: OnPageNumberCallback;

  constructor(
    context: Command.Context | Structures.Message,
    options: PaginatorOptions,
  ) {
    this.context = context;
    this.message = options.message || null;

    if (Array.isArray(options.pages)) {
      this.pages = options.pages;
      this.pageLimit = this.pages.length;
    } else {
      if (options.pageLimit !== undefined) {
        this.pageLimit = Math.max(MIN_PAGE, Math.min(options.pageLimit, MAX_PAGE));
      }
    }

    if (options.page !== undefined) {
      this.page = Math.max(MIN_PAGE, Math.min(options.page, MAX_PAGE));
    }
    this.pageSkipAmount = Math.max(2, options.pageSkipAmount || this.pageSkipAmount);

    if (Array.isArray(options.targets)) {
      for (let target of options.targets) {
        if (typeof(target) === 'string') {
          this.targets.push(target);
        } else {
          this.targets.push(target.id);
        }
      }
    } else {
      if (context instanceof Structures.Message) {
        this.targets.push(context.author.id);
      } else {
        this.targets.push(context.userId);
      }
    }

    if (!this.targets.length) {
      throw new Error('A userId must be specified in the targets array');
    }

    const emojis: PaginatorEmojis = Object.assign({}, PageEmojis, options.emojis);
    for (let key in PageEmojis) {
      const value = (<any> emojis)[key];
      if (typeof(value) === 'string') {
        let emoji: Structures.Emoji;

        const { matches } = Utils.regex(DiscordRegexNames.EMOJI, value);
        if (matches.length) {
          emoji = new Structures.Emoji(context.client, matches[0]);
        } else {
          emoji = new Structures.Emoji(context.client, {name: value});
        }
        this.emojis[key] = emoji;
      }
      if (!(this.emojis[key] instanceof Structures.Emoji)) {
        throw new Error(`Emoji for ${key} must be a string or Emoji structure`);
      }
    }

    this.onError = options.onError;
    this.onExpire = options.onExpire;
    this.onPage = options.onPage;
    this.onPageNumber = options.onPageNumber;

    Object.defineProperties(this, {
      context: {enumerable: false},
      custom: {enumerable: false},
      emojis: {enumerable: false},
      message: {enumerable: false},
      timeout: {enumerable: false},
      onError: {enumerable: false},
      onExpire: {enumerable: false},
      onPage: {enumerable: false},
      onPageNumber: {enumerable: false},
    });
  }

  get isLarge(): boolean {
    return this.pageSkipAmount < this.pageLimit;
  }

  addPage(embed: Utils.Embed): Paginator {
    if (typeof(this.onPage) === 'function') {
      throw new Error('Cannot add a page when onPage is attached to the paginator');
    }
    if (!Array.isArray(this.pages)) {
      this.pages = [];
    }
    this.pages.push(embed);
    this.pageLimit = this.pages.length;
    return this;
  }

  async clearCustomMessage(): Promise<void> {
    this.custom.timeout.stop();
    if (this.custom.message) {
      try {
        await this.custom.message.delete();
      } catch(error) {}
      this.custom.message = null;
    }
  }

  async getGuidePage(): Promise<Utils.Embed> {
    const embed = new Utils.Embed();
    embed.setTitle('Interactive Paginator Guide');
    embed.setDescription([
      'This allows you to navigate through pages of text using reactions.\n',
      `${this.emojis.previous} - Goes back one page`,
      `${this.emojis.next} - Goes forward one page`,
      `${this.emojis.custom} - Allows you to choose a number via text`,
      `${this.emojis.stop} - Stops the paginator`,
      `${this.emojis.info} - Shows this guide`,
    ].join('\n'));
    embed.setFooter(`We were on page ${this.page.toLocaleString()}.`);
    return embed;
  }

  async getPage(page: number): Promise<Utils.Embed> {
    if (typeof(this.onPage) === 'function') {
      return await Promise.resolve(this.onPage(this.page));
    }
    if (Array.isArray(this.pages)) {
      page -= 1;
      if (page in this.pages) {
        return this.pages[page];
      }
    }
    throw new Error(`Page ${page} not found`);
  }

  async setPage(page: number): Promise<void> {
    if (this.message && (this.isOnGuide || page !== this.page)) {
      this.isOnGuide = false;
      this.page = page;
      const embed = await this.getPage(page);
      await this.message.edit({allowedMentions: {parse: []}, embed});
    }
  }

  async onMessageReactionAdd(
    {messageId, reaction, userId}: {messageId: string, reaction: Structures.Reaction, userId: string},
  ) {
    if (this.stopped) {
      return;
    }
    if (!this.message || this.message.id !== messageId) {
      return;
    }
    if (!this.targets.includes(userId) && !this.context.client.isOwner(userId)) {
      return;
    }
    if (this.ratelimitTimeout.hasStarted) {
      return;
    }

    try {
      switch (reaction.emoji.endpointFormat) {
        case this.emojis.previousDouble.endpointFormat: {
          if (!this.isLarge) {
            return;
          }
          const page = Math.max(this.page - this.pageSkipAmount, MIN_PAGE);
          await this.setPage(page);
        }; break;
        case this.emojis.previous.endpointFormat: {
          const page = this.page - 1;
          if (MIN_PAGE <= page) {
            await this.setPage(page);
          }
        }; break;

        case this.emojis.next.endpointFormat: {
          const page = this.page + 1;
          if (page <= this.pageLimit) {
            await this.setPage(page);
          }
        }; break;
        case this.emojis.nextDouble.endpointFormat: {
          if (!this.isLarge) {
            return;
          }
          const page = Math.min(this.page + this.pageSkipAmount, this.pageLimit);
          await this.setPage(page);
        }; break;

        case this.emojis.custom.endpointFormat: {
          if (!this.custom.message) {
            await this.clearCustomMessage();
            this.custom.message = await this.message.reply('What page would you like to go to?');
            this.custom.timeout.start(this.custom.expire, async () => {
              await this.clearCustomMessage();
            });
          }
        }; break;
        case this.emojis.stop.endpointFormat: {
          await this.onStop();
        }; break;
        case this.emojis.info.endpointFormat: {
          if (!this.isOnGuide) {
            this.isOnGuide = true;
            const embed = await this.getGuidePage();
            await this.message.edit({allowedMentions: {parse: []}, embed});
          }
        }; break;
        default: {
          return;
        };
      }

      this.timeout.start(this.expires, this.onStop.bind(this));
      this.ratelimitTimeout.start(this.ratelimit, () => {});
      /*
      if (this.message.canManage) {
        await reaction.delete(userId);
      }
      */
    } catch(error) {
      if (typeof(this.onError) === 'function') {
        await Promise.resolve(this.onError(error, this));
      }
    }
  }

  async onStop(error?: any, clearEmojis: boolean = true) {
    if (PaginatorsStore.has(this.context.channelId)) {
      const paginator = <Paginator> PaginatorsStore.get(this.context.channelId);
      if (paginator === this) {
        PaginatorsStore.delete(this.context.channelId);
      }
    }

    this.reset();
    if (!this.stopped) {
      this.stopped = true;
      try {
        if (error) {
          if (typeof(this.onError) === 'function') {
            await Promise.resolve(this.onError(error, this));
          }
        }
        if (typeof(this.onExpire) === 'function') {
          await Promise.resolve(this.onExpire(this));
        }
      } catch(error) {
        if (typeof(this.onError) === 'function') {
          await Promise.resolve(this.onError(error, this));
        }
      }
      if (clearEmojis) {
        if (this.message && this.message.canManage) {
          try {
            await this.message.deleteReactions();
          } catch(error) {}
        }
      }
      await this.clearCustomMessage();

      this.onError = undefined;
      this.onExpire = undefined;
      this.onPage = undefined;
      this.onPageNumber = undefined;
    }
  }

  reset() {
    this.timeout.stop();
    this.custom.timeout.stop();
    this.ratelimitTimeout.stop();
  }

  async start() {
    if (typeof(this.onPage) !== 'function' && !(this.pages && this.pages.length)) {
      throw new Error('Paginator needs an onPage function or at least one page added to it');
    }

    let message: Structures.Message;
    if (this.message) {
      message = this.message;
    } else {
      if (!this.context.canReply) {
        throw new Error('Cannot create messages in this channel');
      }
      const embed = await this.getPage(this.page);
      if (this.context instanceof Command.Context) {
        message = this.message = await editOrReply(this.context, {embed});
      } else {
        message = this.message = await this.context.reply({embed});
      }
    }

    this.reset();
    if (!this.stopped && this.pageLimit !== MIN_PAGE && message.canReact) {
      setImmediate(async () => {
        try {
          if (PaginatorsStore.has(this.context.channelId)) {
            const paginator = PaginatorsStore.get(this.context.channelId) as Paginator;
            if (message === paginator.message) {
              await paginator.stop(false);
            } else {
              await paginator.stop();
            }
          }
          PaginatorsStore.insert(this);

          this.timeout.start(this.expires, this.onStop.bind(this));
          const emojis = <Array<Structures.Emoji>> [
            (this.isLarge) ? this.emojis.previousDouble : null,
            this.emojis.previous,
            this.emojis.next,
            (this.isLarge) ? this.emojis.nextDouble : null,
            this.emojis.custom,
            this.emojis.stop,
            this.emojis.info,
          ].filter((v) => v);

          for (let emoji of emojis) {
            if (this.stopped || message.deleted) {
              break;
            }
            if (message.reactions.has(emoji.id || emoji.name)) {
              continue;
            }
            await message.react(emoji.endpointFormat);
          }
        } catch(error) {
          if (typeof(this.onError) === 'function') {
            this.onError(error, this);
          }
        }
      });
    }

    return message;
  }

  stop(clearEmojis: boolean = true) {
    return this.onStop(null, clearEmojis);
  }
}
