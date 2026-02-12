const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const list = require('../subcommands/quest/list');
const create = require('../subcommands/quest/create');
const reroll = require('../subcommands/quest/reroll');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Quest system')
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View your quests')
        .addStringOption(o =>
          o.setName('category')
            .setDescription('Filter by category')
            .addChoices(
              { name: 'daily', value: 'daily' },
              { name: 'weekly', value: 'weekly' },
              { name: 'lifetime', value: 'lifetime' },
              { name: 'event', value: 'event' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll your daily or weekly quests (costs wirlies)')
        .addStringOption(o =>
          o.setName('category')
            .setDescription('Which category to reroll')
            .addChoices(
              { name: 'daily', value: 'daily' },
              { name: 'weekly', value: 'weekly' }
            )
            .setRequired(true)
        )
        .addStringOption(o =>
  o
    .setName('quest')
    .setDescription('Quest name to reroll')
    .setRequired(true)
)
    )
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a quest (admin)')

        .addStringOption(o => o.setName('key').setDescription('Unique quest key').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('Quest name').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Quest description').setRequired(true))

        .addStringOption(o =>
          o.setName('category')
            .setDescription('Quest category')
            .addChoices(
              { name: 'daily', value: 'daily' },
              { name: 'weekly', value: 'weekly' },
              { name: 'lifetime', value: 'lifetime' },
              { name: 'event', value: 'event' }
            )
            .setRequired(true)
        )

        .addStringOption(o =>
          o.setName('mode')
            .setDescription('Quest mode')
            .addChoices(
              { name: 'count (progress)', value: 'count' },
              { name: 'completion (own all)', value: 'completion' }
            )
            .setRequired(true)
        )

        .addStringOption(o =>
          o.setName('trigger')
            .setDescription('Trigger (ignored for completion)')
            .addChoices(
              { name: 'any', value: 'any' },
              { name: 'summon', value: 'summon' },
              { name: 'route', value: 'route' },
              { name: 'bewitch', value: 'bewitch' },
              { name: 'enchant', value: 'enchant' },
              { name: 'command', value: 'command' }
            )
            .setRequired(false)
        )

        // count quests
        .addIntegerOption(o => o.setName('count').setDescription('How many times (count quests only)').setRequired(false))
        .addStringOption(o => o.setName('command_name').setDescription('Command name for trigger=command').setRequired(false))

        // filters
        .addIntegerOption(o => o.setName('version').setDescription('Card version filter').setRequired(false))
        .addStringOption(o => o.setName('group').setDescription('Card group filter').setRequired(false))
        .addStringOption(o => o.setName('era').setDescription('Card era filter').setRequired(false))

        // route gating
        .addIntegerOption(o => o.setName('min_wirlies').setDescription('Min wirlies earned (route)').setRequired(false))
        .addIntegerOption(o => o.setName('min_keys').setDescription('Min keys earned (route)').setRequired(false))

        // rewards
        .addIntegerOption(o => o.setName('reward_wirlies').setDescription('Reward wirlies').setRequired(false))
        .addIntegerOption(o => o.setName('reward_keys').setDescription('Reward keys').setRequired(false))

        // expiry
        .addStringOption(o =>
  o
    .setName('expires_on')
    .setDescription('Quest expiration date (YYYY-MM-DD)')
    .setRequired(false)
)
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return list.execute(interaction);
    if (sub === 'create') return create.execute(interaction);
    if (sub === 'reroll') return reroll.execute(interaction);
  },
};
