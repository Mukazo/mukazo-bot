const { SlashCommandBuilder } = require('discord.js');
const burnSession = require('../../utils/burnSession');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('burn')
    .setDescription('Burn cards for Wirlies and Keys')
    .addBooleanOption(o =>
      o.setName('exclude_v5')
        .setDescription('Exclude all Version 5 cards')
        .setRequired(true)
    )
    .addStringOption(o => o.setName('group').setDescription('Filter by groups'))
    .addStringOption(o => o.setName('name').setDescription('Filter by names'))
    .addStringOption(o => o.setName('era').setDescription('Filter by eras'))
    .addStringOption(o => o.setName('version').setDescription('Filter by versions (e.g. 1,3,5)'))
    .addStringOption(o => o.setName('exclude_name').setDescription('Exclude names'))
    .addStringOption(o => o.setName('exclude_era').setDescription('Exclude eras')),

  async execute(interaction) {
    await burnSession(interaction);
  }
};