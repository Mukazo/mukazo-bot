const { EmbedBuilder } = require('discord.js');
const User = require('../../../models/User');

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const user = await User.findOne({ userId });

    const getPityData = (type) => {
      const data = user?.pityData?.[type] || {};
      return {
        codes: data.codes || [],
        count: data.count || 0,
        until: Math.max(0, 5 - (data.count || 0))
      };
    };

    const events = getPityData('events');
    const monthlies = getPityData('monthlies');

    const embed = new EmbedBuilder()
      .setTitle('Available Shop Packs')
      .setColor('#2f3136')
      .setDescription([
        `**Selective Pack** (500 Wirlies)`,
        `• Each pack contains 5 cards.`,
        `• 75% chance of getting matched input groups/names.`,
        '',
        `**Events & Monthlies Pack** (400 Wirlies + 4 Keys)`,
        `• Each pack contains 4 cards.`,
        `• 80% chance for pity cards after 5 packs.`,
        '',
        `**Pity Preferences:**`,
        `• Events: ${events.codes.length ? events.codes.map(c => `\`${c}\``).join(', ') : '*None*'} (in ${events.until} packs)`,
        `• Monthlies: ${monthlies.codes.length ? monthlies.codes.map(c => `\`${c}\``).join(', ') : '*None*'} (in ${monthlies.until} packs)`
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }
};