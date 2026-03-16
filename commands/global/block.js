const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

function parseCsv(input, limit = 5) {
  return (input || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, limit);
}

module.exports = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('block')
    .setDescription('Block up to 5 groups and 5 names from summoning.')
    .addStringOption(option =>
      option.setName('groups')
        .setDescription('Comma-separated groups to block [max 5]')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('names')
        .setDescription('Comma-separated names to block [max 5]')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const newGroups = parseCsv(interaction.options.getString('groups'), 5);
    const newNames = parseCsv(interaction.options.getString('names'), 5);

    let user = await User.findOne({ userId });
    if (!user) {
      user = await User.create({ userId });
    }

    if (!user.blockedPulls) {
      user.blockedPulls = { groups: [], names: [] };
    }

    const currentGroups = user.blockedPulls.groups || [];
    const currentNames = user.blockedPulls.names || [];

    // If no input, just show current values
    if (!newGroups.length && !newNames.length) {
      const embed = new EmbedBuilder()
        .setDescription([
          '## ꔫ Blocked Settings',
          '',
          `> ╰┈ **Groups:** ${currentGroups.length ? currentGroups.join(', ') : 'None'}`,
          `> ╰┈ **Names:** ${currentNames.length ? currentNames.join(', ') : 'None'}`,
          '',
          '_Blocked Groups & Names only apply to V1-V4 cards_'
        ].join('\n'));

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    const addedGroups = newGroups.filter(g => !currentGroups.includes(g));
    const addedNames = newNames.filter(n => !currentNames.includes(n));

    const mergedGroups = [...new Set([...currentGroups, ...newGroups])];
    const mergedNames = [...new Set([...currentNames, ...newNames])];

    if (mergedGroups.length > 5) {
      return interaction.editReply({
        content: `You can only block up to **5 groups** total. You currently have ${currentGroups.length} blocked and tried to add ${addedGroups.length}.`,
        ephemeral: true
      });
    }

    if (mergedNames.length > 5) {
      return interaction.editReply({
        content: `You can only block up to **5 names** total. You currently have ${currentNames.length} blocked and tried to add ${addedNames.length}.`,
        ephemeral: true
      });
    }

    user.blockedPulls = {
      groups: mergedGroups,
      names: mergedNames,
    };

    await user.save();

    const embed = new EmbedBuilder()
      .setDescription([
        '## ꔫ Blocked Settings Updated',
        '',
        `> ╰┈ **Groups:** ${mergedGroups.length ? mergedGroups.join(', ') : 'None'}`,
        `> ╰┈ **Names:** ${mergedNames.length ? mergedNames.join(', ') : 'None'}`,
        '',
        `> **Groups Added:** ${addedGroups.length ? addedGroups.join(', ') : 'None'}`,
        `> **Names Added:** ${addedNames.length ? addedNames.join(', ') : 'None'}`,
        '',
        '_Blocked Groups & Names only apply to V1-V4 cards._'
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  },
};