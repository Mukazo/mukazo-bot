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
  data: new SlashCommandBuilder()
    .setName('block')
    .setDescription('Block up to 5 groups, names, or exact group+name pairs from V1–V4 generation.')
    .addStringOption(option =>
      option.setName('groups')
        .setDescription('Comma-separated groups to block (max 5 total)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('names')
        .setDescription('Comma-separated names to block (max 5 total)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const newGroups = parseCsv(interaction.options.getString('groups'), 5);
    const newNames = parseCsv(interaction.options.getString('names'), 5);

    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    if (!user.blockedPulls) {
      user.blockedPulls = { groups: [], names: [], pairs: [] };
    }

    const currentGroups = user.blockedPulls.groups || [];
    const currentNames = user.blockedPulls.names || [];
    const currentPairs = user.blockedPulls.pairs || [];

    if (!newGroups.length && !newNames.length) {
      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setDescription([
          '## ₍ ᐢ.ˬ.ᐢ₎ Blocked Pull Settings',
          '',
          `> **Groups:** ${currentGroups.length ? currentGroups.join(', ') : 'None'}`,
          `> **Names:** ${currentNames.length ? currentNames.join(', ') : 'None'}`,
          `> **Pairs:** ${currentPairs.length ? currentPairs.map(p => `${p.group} + ${p.name}`).join(', ') : 'None'}`,
          '',
          '_These blocks only affect Version 1–4 generation._'
        ].join('\n'));

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    let addedGroups = [];
    let addedNames = [];
    let addedPairs = [];
    // If both are provided and lengths match, treat them as exact pairs
    if (newGroups.length && newNames.length && newGroups.length === newNames.length) {
      const pairKeys = new Set(currentPairs.map(p => `${p.group}:::${p.name}`));

      for (let i = 0; i < newGroups.length; i++) {
        const pair = { group: newGroups[i], name: newNames[i] };
        const key = `${pair.group}:::${pair.name}`;

        if (!pairKeys.has(key)) {
          currentPairs.push(pair);
          addedPairs.push(pair);
          pairKeys.add(key);
        }
      }

      if (currentPairs.length > 5) {
        return interaction.editReply({
          content: 'You can only block up to **5 exact group+name pairs** total.',
          ephemeral: true
        });
      }

      user.blockedPulls.pairs = currentPairs;
    } else {
      addedGroups = newGroups.filter(g => !currentGroups.includes(g));
      addedNames = newNames.filter(n => !currentNames.includes(n));

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

      user.blockedPulls.groups = mergedGroups;
      user.blockedPulls.names = mergedNames;
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setColor('#2f3136')
      .setDescription([
        '## ₍ ᐢ.ˬ.ᐢ₎ Blocked Pull Settings Updated',
        '',
        `> **Groups:** ${user.blockedPulls.groups.length ? user.blockedPulls.groups.join(', ') : 'None'}`,
        `> **Names:** ${user.blockedPulls.names.length ? user.blockedPulls.names.join(', ') : 'None'}`,
        `> **Pairs:** ${user.blockedPulls.pairs.length ? user.blockedPulls.pairs.map(p => `${p.group} + ${p.name}`).join(', ') : 'None'}`,
        '',
        `> **Groups Added:** ${addedGroups.length ? addedGroups.join(', ') : 'None'}`,
        `> **Names Added:** ${addedNames.length ? addedNames.join(', ') : 'None'}`,
        `> **Pairs Added:** ${addedPairs.length ? addedPairs.map(p => `${p.group} + ${p.name}`).join(', ') : 'None'}`,
        '',
        '_These blocks only affect Version 1–4 generation._'
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  },
};