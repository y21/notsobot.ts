import { Command, Utils } from 'detritus-client';

const { Markup } = Utils;

import { searchGoogleContentVisionOCR } from '../api';
import { EmbedBrands, EmbedColors, GoogleLocalesText } from '../constants';
import { Parameters, onRunError, onTypeError } from '../utils';


export interface CommandArgs {
  noembed: boolean,
  url: string,
}

export default (<Command.CommandOptions> {
  name: 'ocr',
  args: [{name: 'noembed', type: Boolean}],
  label: 'url',
  type: Parameters.lastImageUrl,
  onBefore: (context) => {
    const channel = context.channel;
    return (channel) ? channel.canAttachFiles : false;
  },
  onCancel: (context) => context.reply('⚠ Unable to send files in this channel.'),
  onBeforeRun: (context, args) => !!args.url,
  onCancelRun: (context, args) => {
    if (args.url === undefined) {
      return context.editOrReply('⚠ Unable to find any messages with an image.');
    } else {
      return context.editOrReply('⚠ Unable to find that user or it was an invalid url.');
    }
  },
  run: async (context, args: CommandArgs) => {
    await context.triggerTyping();

    const ocr = await searchGoogleContentVisionOCR(context, {
      url: args.url,
      userId: context.user.id,
    });

    const [ response ] = ocr.responses;
    const { textAnnotations } = response;

    if (args.noembed) {
      if (!textAnnotations.length) {
        return context.editOrReply({content: '⚠ No text detect'});
      }

      const annotation = textAnnotations[0];
      let title: string;
      if (annotation.locale in GoogleLocalesText) {
        title = GoogleLocalesText[annotation.locale];
      } else {
        title = annotation.locale;
      }

      return context.editOrReply([
        title,
        Markup.codeblock(annotation.description),
      ].join('\n'));
    } else {
      const embed = new Utils.Embed();
      embed.setColor(EmbedColors.DEFAULT);

      if (!textAnnotations.length) {
        embed.setColor(EmbedColors.ERROR);
        embed.setTitle('⚠ Command Error');
        embed.setDescription('No text detected');

        return context.editOrReply({embed});
      }

      const annotation = textAnnotations[0];
      if (annotation.locale in GoogleLocalesText) {
        embed.setTitle(GoogleLocalesText[annotation.locale]);
      } else {
        embed.setTitle(annotation.locale);
      }
      embed.setDescription(Markup.codeblock(annotation.description, {mentions: false}));
      embed.setFooter('Optical Character Recognition', EmbedBrands.GOOGLE_GO);

      return context.editOrReply({embed});
    }
  },
  onRunError,
  onTypeError,
});
