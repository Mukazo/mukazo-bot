// commands/guild-only/card.js
const { SlashCommandBuilder } = require('discord.js');
const createCard = require('../subcommands/card/create.js');
// const editCard = require('../../subcommands/card/edit.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Manage cards')
    .setDefaultMemberPermissions('0')
    .addSubcommand(sub =>
      sub.setName('create')
      .setDescription('create a card')
      .addStringOption(opt =>
      opt.setName('cardcode').setDescription('card code').setRequired(true))
      .addStringOption(opt =>
      opt.setName('category').setDescription('category of card')
        .addChoices(
          { name: 'Music', value: 'music' },
          { name: 'Animanga', value: 'animanga' },
          { name: 'Video Games', value: 'video games' },
          { name: 'Entertainment', value: 'entertainment' },
          { name: 'Monthlies', value: 'monthlies' },
          { name: 'Events', value: 'events' },
          { name: 'Specials', value: 'specials' }
        ).setRequired(true))
      .addStringOption(opt =>
      opt.setName('version')
        .setDescription('version of card')
        .setRequired(true)
        .addChoices(
          { name: 'Version 1', value: '1' },
          { name: 'Version 2', value: '2' },
          { name: 'Version 3', value: '3' },
          { name: 'Version 4', value: '4' },
          { name: 'Version 5', value: '5' }
        ))
      .addStringOption(opt => opt.setName('group').setDescription('group of card').setRequired(true))
      .addStringOption(opt =>
      opt.setName('name').setDescription('name of card').setRequired(true))
      .addUserOption(opt =>
      opt.setName('designer').setDescription('initial designer').setRequired(true))
      .addBooleanOption(opt =>
      opt.setName('active').setDescription('card droppable and currently active?').setRequired(true))
      .addAttachmentOption(opt =>
      opt.setName('image').setDescription('upload the card image').setRequired(true))
      .addStringOption(opt =>
      opt.setName('era').setDescription('era of card').setRequired(false))
      .addStringOption(opt =>
      opt.setName('emoji').setDescription('optional emoji').setRequired(false))
      .addUserOption(opt =>
      opt.setName('designer2').setDescription('optional second designer').setRequired(false))
      .addUserOption(opt =>
      opt.setName('designer3').setDescription('optional third designer').setRequired(false))
      .addIntegerOption(opt =>
      opt.setName('availablequantity').setDescription('limited quantity').setRequired(false))
      .addStringOption(opt =>
      opt.setName('batch')
      .setDescription('Batch code to assign this card to')
      .setRequired(false)
)


    )
    .addSubcommand(sub =>
      sub.setName('edit')
        .setDescription('Edit an existing card')
        .addStringOption(opt => opt.setName('card_id').setDescription('Card ID').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('New name'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') return createCard.execute(interaction);
    if (sub === 'edit') return editCard.execute(interaction);
  }
};
