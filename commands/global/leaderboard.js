const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const CardLeaderboard = require('../../models/CardLeaderboard');
const { makeScopeKey, updateCardLeaderboard } = require('../../updateCardLeaderboards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cardleaderboard')
    .setDescription('View card inventory leaderboards')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Leaderboard type')
        .setRequired(true)
        .addChoices(
          { name: 'Distinct cards owned', value: 'distinct' },
          { name: 'Version-weighted copies', value: 'copies' },
        )
    )
    .addStringOption(o =>
      o.setName('group')
        .setDescription('Filter by group or group alias')
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Filter by name or name alias')
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('era')
        .setDescription('Filter by era')
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const group = interaction.options.getString('group');
    const name = interaction.options.getString('name');
    const era = interaction.options.getString('era');

    const scopeKey = makeScopeKey({ group, name, era });

    let rows = await CardLeaderboard.find({ scopeKey, type })
      .sort({ score: -1 })
      .limit(10)
      .lean();

    if (!rows.length && (group || name || era)) {
      await updateCardLeaderboard({ group, name, era });

      rows = await CardLeaderboard.find({ scopeKey, type })
        .sort({ score: -1 })
        .limit(10)
        .lean();
    }

    if (!rows.length) {
      return interaction.editReply({
        content: 'No leaderboard data found for that filter.',
      });
    }

    const desc = rows.map((row, index) => {
      return `**${index + 1}.** <@${row.userId}> — **${row.score.toLocaleString()}**`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#2f3136')
      .setDescription([
        `# Card Leaderboard`,
        `**Type:** ${type === 'distinct' ? 'Distinct Cards' : 'Version-Weighted Copies'}`,
        group ? `**Group:** ${group}` : null,
        name ? `**Name:** ${name}` : null,
        era ? `**Era:** ${era}` : null,
        '',
        desc,
      ].filter(Boolean).join('\n'));

    return interaction.editReply({ embeds: [embed] });
  },
};