// commands/guild-only/series.js
const { SlashCommandBuilder } = require('discord.js');
const createSeries = require('../subcommands/series/create.js');
const editSeries = require('../subcommands/series/edit.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('series')
    .setDescription('Manage card series')
    .setDefaultMemberPermissions('0')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a series')
        .addStringOption(opt =>
          opt.setName('code').setDescription('Series code (used by cards)').setRequired(true))
        .addStringOption(opt =>
          opt.setName('name').setDescription('Series name').setRequired(true))
        .addStringOption(opt =>
          opt.setName('description').setDescription('Optional description'))
        .addAttachmentOption(opt =>
          opt.setName('image').setDescription('Series logo').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('edit')
        .setDescription('Edit a series')
        .addStringOption(opt =>
          opt.setName('code').setDescription('Series code').setRequired(true))
        .addStringOption(opt =>
          opt.setName('name').setDescription('New name'))
        .addStringOption(opt =>
          opt.setName('description').setDescription('New description'))
        .addAttachmentOption(opt =>
          opt.setName('image').setDescription('Replace logo'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return createSeries.execute(interaction);
    if (sub === 'edit') return editSeries.execute(interaction);
  }
};
