const { SlashCommandBuilder } = require('discord.js');
const list = require('../subcommands/quest/list');
const create = require('../subcommands/quest/create');
const reroll = require('../subcommands/quest/reroll');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Quest system')

    // LIST
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

    // REROLL (USES WIRLIES NOW)
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll a daily or weekly quest (costs Wirlies)')
        .addStringOption(o =>
          o.setName('category')
            .addChoices(
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' }
            )
            .setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName('slot')
            .setDescription('Quest slot (1–3)')
            .setMinValue(1)
            .setMaxValue(3)
            .setRequired(true)
        )
    )

    // CREATE (ADMIN)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a quest')
        .setDefaultMemberPermissions('0')

        // Identity
        .addStringOption(o => o.setName('key').setDescription('Unique quest key').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('Quest name').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Quest description').setRequired(true))

        // Behavior
        .addStringOption(o =>
          o.setName('category')
            .addChoices(
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' },
              { name: 'Lifetime', value: 'lifetime' },
              { name: 'Event', value: 'event' }
            )
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('type')
            .addChoices(
              { name: 'Summon', value: 'summon' },
              { name: 'Enchant', value: 'enchant' },
              { name: 'Claim', value: 'claim' },
              { name: 'Any', value: 'any' }
            )
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('mode')
            .addChoices(
              { name: 'Progress', value: 'progress' },
              { name: 'Completion (own all)', value: 'completion' }
            )
            .setRequired(true)
        )

        // Conditions
        .addIntegerOption(o => o.setName('count').setDescription('Required amount (progress only)'))
        .addIntegerOption(o => o.setName('version').setDescription('Card version filter'))
        .addStringOption(o => o.setName('group').setDescription('Group filter'))
        .addStringOption(o => o.setName('era').setDescription('Era filter'))

        // Expiry
        .addIntegerOption(o =>
          o.setName('expires_in_hours')
            .setDescription('Expire after X hours (optional)')
        )

        // Rewards
        .addIntegerOption(o => o.setName('wirlies').setDescription('Reward wirlies'))
        .addIntegerOption(o => o.setName('keys').setDescription('Reward keys'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return list.execute(interaction);
    if (sub === 'create') return create.execute(interaction);
    if (sub === 'reroll') return reroll.execute(interaction);
  },
};