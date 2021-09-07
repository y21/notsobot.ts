import { Interaction } from 'detritus-client';
import { InteractionCallbackTypes } from 'detritus-client/lib/constants';
import { Embed, Markup } from 'detritus-client/lib/utils';

import { EmbedBrands, EmbedColors } from '../../../../../constants';

import { BaseInteractionCommandOption } from '../../../basecommand';


export interface CommandArgs {

}

export class SettingsPrefixesClearCommand extends BaseInteractionCommandOption {
  description = 'Clear all custom prefixes in the Server';
  name = 'clear';

  async run(context: Interaction.InteractionContext, args: CommandArgs) {
    return context.respond(InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE, {
      content: 'wip',
      flags: 64,
    });
  }
}
