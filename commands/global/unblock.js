const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

function parseCsv(input) {
  return (input || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('unblock')
    .setDescription('Remove blocked groups or names')
    .addStringOption(option =>
      option.setName('groups')
        .setDescription('Comma-separated groups to be removed')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('names')
        .setDescription('Comma-separated names to be removed')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const groups = parseCsv(interaction.options.getString('groups'));
    const names = parseCsv(interaction.options.getString('names'));

    let user = await User.findOne({ userId });
    if (!user) {
      return interaction.editReply({ content: 'You do not have any blocked values set.' });
    }

    if (!user.blockedPulls) {
      user.blockedPulls = { groups: [], names: [] };
    }

    // If no input, clear everything
    if (!groups.length && !names.length) {
      user.blockedPulls = {
        groups: [],
        names: [],
      };

      await user.save();

      const embed = new EmbedBuilder()
        .setDescription([
          '## ꔫ Blocked Settings Cleared',
          '',
          '> ╰┈ **Groups:** None',
          '> ╰┈ **Names:** None',
          '',
          '_All V1–V4 block settings have been removed._'
        ].join('\n'));

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    user.blockedPulls.groups = (user.blockedPulls.groups || []).filter(g => !groups.includes(g));
    user.blockedPulls.names = (user.blockedPulls.names || []).filter(n => !names.includes(n));

    await user.save();

    const embed = new EmbedBuilder()
      .setDescription([
        '## ꔫ Blocked Settings Updated',
        '',
        `> ╰┈ **Groups:** ${user.blockedPulls.groups.length ? user.blockedPulls.groups.join(', ') : 'None'}`,
        `> ╰┈ **Names:** ${user.blockedPulls.names.length ? user.blockedPulls.names.join(', ') : 'None'}`,
        '',
        '_Blocked Groups & Names only apply to V1-V4 cards._'
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  },
};