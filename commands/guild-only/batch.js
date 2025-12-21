const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const createBatch = require('../subcommands/batch/create.js');
const editBatch = require('../subcommands/batch/edit.js');
const listBatch = require('../subcommands/batch/list.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('batch')
    .setDescription('Manage batches')
    
    // CREATE
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new batch')
        .addStringOption(opt => opt.setName('code').setDescription('Unique batch code').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('Batch name').setRequired(true))
        .addStringOption(opt => opt.setName('releaseat').setDescription('Release date (YYYY-MM-DD)').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Optional description'))
    )

    // LIST
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all batches')
    )

    // EDIT
    .addSubcommand(sub =>
      sub.setName('edit')
        .setDescription('Edit an existing batch')
        .addStringOption(opt => opt.setName('code').setDescription('Batch code to edit').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('New name'))
        .addStringOption(opt => opt.setName('description').setDescription('New description'))
        .addStringOption(opt => opt.setName('releaseat').setDescription('New release date (YYYY-MM-DD)'))
        .addBooleanOption(opt => opt.setName('releasenow').setDescription('Release this batch immediately'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') return createBatch.execute(interaction);
    if (sub === 'edit') return editBatch.execute(interaction);
    if (sub === 'list') return listBatch.execute(interaction);
  }
};
