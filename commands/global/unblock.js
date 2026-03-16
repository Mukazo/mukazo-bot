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
    .setDescription('Remove blocked groups, names, or exact group+name pairs.')
    .addStringOption(option =>
      option.setName('groups')
        .setDescription('Comma-separated blocked groups')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('names')
        .setDescription('Comma-separated blocked names')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const groups = parseCsv(interaction.options.getString('groups'));
    const names = parseCsv(interaction.options.getString('names'));

    const user = await User.findOne({ userId });
    if (!user || !user.blockedPulls) {
      return interaction.editReply({ content: 'You do not have any blocked values set.' });
    }

    user.blockedPulls.groups ||= [];
    user.blockedPulls.names ||= [];
    user.blockedPulls.pairs ||= [];

    if (!groups.length && !names.length) {
      user.blockedPulls = {
        groups: [],
        names: [],
        pairs: [],
      };

      await user.save();

      const embed = new EmbedBuilder()
        .setDescription([
          '## Blocked Pull Settings Cleared',
          '',
          '> **Groups:** None',
          '> **Names:** None',
          '> **Pairs:** None',
          '',
          '_Blocked Values only apply to V1-V4 cards._'
        ].join('\n'));

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    let removedGroups = [];
    let removedNames = [];
    let removedPairs = [];

    // If both provided and same length, remove exact pairs
    if (groups.length && names.length && groups.length === names.length) {
      const pairKeysToRemove = new Set(groups.map((g, i) => `${g}:::${names[i]}`));

      removedPairs = user.blockedPulls.pairs.filter(p =>
        pairKeysToRemove.has(`${p.group}:::${p.name}`)
      );

      user.blockedPulls.pairs = user.blockedPulls.pairs.filter(p =>
        !pairKeysToRemove.has(`${p.group}:::${p.name}`)
      );
    } else {
      removedGroups = user.blockedPulls.groups.filter(g => groups.includes(g));
      removedNames = user.blockedPulls.names.filter(n => names.includes(n));

      user.blockedPulls.groups = user.blockedPulls.groups.filter(g => !groups.includes(g));
      user.blockedPulls.names = user.blockedPulls.names.filter(n => !names.includes(n));
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setDescription([
        '## Blocked Pull Settings Updated',
        '',
        `> **Groups:** ${user.blockedPulls.groups.length ? user.blockedPulls.groups.join(', ') : 'None'}`,
        `> **Names:** ${user.blockedPulls.names.length ? user.blockedPulls.names.join(', ') : 'None'}`,
        `> **Pairs:** ${user.blockedPulls.pairs.length ? user.blockedPulls.pairs.map(p => `${p.group} + ${p.name}`).join(', ') : 'None'}`,
        '',
        `> **Groups Removed:** ${removedGroups.length ? removedGroups.join(', ') : 'None'}`,
        `> **Names Removed:** ${removedNames.length ? removedNames.join(', ') : 'None'}`,
        `> **Pairs Removed:** ${removedPairs.length ? removedPairs.map(p => `${p.group} + ${p.name}`).join(', ') : 'None'}`,
        '',
        '_Blocked Values only apply to V1-V4 cards._'
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  },
};