const { SlashCommandBuilder } = require('discord.js');
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
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' },
              { name: 'Lifetime', value: 'lifetime' },
              { name: 'Event', value: 'event' }
            )
        )
    )

    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll a daily/weekly quest (costs Wirlies)')
        .addStringOption(o =>
          o.setName('category')
          .setDescription('which category')
            .addChoices(
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' }
            )
            .setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName('slot')
            .setDescription('Quest slot 1–3')
            .setMinValue(1)
            .setMaxValue(3)
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
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' },
              { name: 'Lifetime', value: 'lifetime' },
              { name: 'Event', value: 'event' }
            )
            .setRequired(true)
        )

        .addStringOption(o =>
          o.setName('trigger')
            .setDescription('What increments it')
            .addChoices(
              { name: 'Summon', value: 'summon' },
              { name: 'Enchant', value: 'enchant' },
              { name: 'Route', value: 'route' },
              { name: 'Command Usage', value: 'command' },
              { name: 'Any', value: 'any' }
            )
            .setRequired(true)
        )

        .addStringOption(o =>
          o.setName('mode')
            .setDescription('Quest mode')
            .addChoices(
              { name: 'Progress', value: 'progress' },
              { name: 'Completion (own all)', value: 'completion' }
            )
            .setRequired(true)
        )

        .addStringOption(o =>
          o.setName('prerequisite')
            .setDescription('Prerequisite quest key')
        )
        .addIntegerOption(o =>
          o.setName('expires_in_hours')
            .setDescription('Expire after X hours (optional)')
        )

        // progress conditions
        .addIntegerOption(o => o.setName('count').setDescription('Required count (progress only)'))

        // command usage condition
        .addStringOption(o => o.setName('command_name').setDescription('Command name (for trigger=command)'))

        // route condition
        .addIntegerOption(o => o.setName('min_wirlies').setDescription('Min wirlies earned in a route run (trigger=route)'))

        // card filters
        .addIntegerOption(o => o.setName('version').setDescription('Card version filter'))
        .addStringOption(o => o.setName('group').setDescription('Group filter'))
        .addStringOption(o => o.setName('era').setDescription('Era filter'))

        // rewards
        .addIntegerOption(o => o.setName('reward_wirlies').setDescription('Reward wirlies'))
        .addIntegerOption(o => o.setName('reward_keys').setDescription('Reward keys'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return list.execute(interaction);
    if (sub === 'reroll') return reroll.execute(interaction);
    if (sub === 'create') return create.execute(interaction);
  },
};
