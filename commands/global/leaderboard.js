const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const CardLeaderboard = require('../../models/CardLeaderboard');
const { makeScopeKey, updateCardLeaderboard } = require('../../updateCardLeaderboards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View Mukazo card leaderboards!')
    .addStringOption(o =>
      o.setName('group')
        .setDescription('Filter by group or group alias')
    )
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Filter by name or name alias')
    )
    .addStringOption(o =>
      o.setName('era')
        .setDescription('Filter by era')
    ),

  async execute(interaction) {
    const group = interaction.options.getString('group');
    const name = interaction.options.getString('name');
    const era = interaction.options.getString('era');

    if (!group && !name && !era) {
  return interaction.editReply({
    content: '。You must provide at least one filter : **Group**, **Name**, or **Era**.',
  });
}

    const scopeKey = makeScopeKey({ group, name, era });

    let board = await CardLeaderboard.findOne({ scopeKey }).lean();

    if (!board && (group || name || era)) {
      await updateCardLeaderboard({ group, name, era });
      board = await CardLeaderboard.findOne({ scopeKey }).lean();
    }

    const rows = board?.rows?.slice(0, 10) || [];

    if (!rows.length) {
      return interaction.editReply({
        content: 'No leaderboard data found for that filter.',
      });
    }

    const desc = rows.map((row, index) => {
      return `**${index + 1}.** <@${row.userId}> — **${row.score.toLocaleString()}**`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription([
        `## ┈ Mukazo Leaderboard *!*`,
        `-# __Method:__ Version-Weighted Copies`,
        group ? `<:space:1455504212069842956>**Group:** ${group}` : null,
        name ? `<:space:1455504212069842956>**Name:** ${name}` : null,
        era ? `<:space:1455504212069842956>**Era:** ${era}` : null,
        '\n',
        desc,
      ].filter(Boolean).join('\n'));

    return interaction.editReply({ embeds: [embed] });
  },
};