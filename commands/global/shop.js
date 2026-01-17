const { SlashCommandBuilder } = require('discord.js');
const list = require('../subcommands/shop/list');
const buy = require('../subcommands/shop/buy');
const pity = require('../subcommands/shop/pity');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Shop system')
    .addSubcommand(sub =>
      sub.setName('list').setDescription('View available packs')
    )
    .addSubcommand(sub =>
      sub
        .setName('buy')
        .setDescription('Buy a pack')
        .addStringOption(o =>
          o.setName('pack')
            .setDescription('Pack type')
            .addChoices(
              { name: 'Selective', value: 'selective' },
              { name: 'Events', value: 'events' },
              { name: 'Monthlies', value: 'monthlies' }
            )
            .setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName('quantity')
            .setDescription('How many packs (default: 1)')
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addStringOption(o =>
          o.setName('groups')
            .setDescription('Group names')
            .setRequired(false)
        )
        .addStringOption(o =>
          o.setName('names')
            .setDescription('Card names')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
  sub
    .setName('pity')
    .setDescription('Set your pity card codes')
    .addStringOption(o =>
      o.setName('codes')
        .setDescription('Up to 3 card codes')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('pack')
        .setDescription('Which pack to apply the codes to')
        .addChoices(
          { name: 'Events', value: 'events' },
          { name: 'Monthlies', value: 'monthlies' }
        )
        .setRequired(true)
    )
),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return list.execute(interaction);
    if (sub === 'buy') return buy.execute(interaction);
    if (sub === 'pity') return pity.execute(interaction);
  }
};