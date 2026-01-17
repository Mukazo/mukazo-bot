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
        `• Pull 5 cards per pack.`,
        `• 75% chance to match your input (groups/names).`,
        `• Pulls from version 1–4 only.`,
        '',
        `**Events / Monthlies Pack** (400 Wirlies + 4 Keys)`,
        `• Pull 4 cards per pack.`,
        `• 80% chance for favorite codes after 5 packs (resets on 21st).`,
        `• Pulls from custom eras.`,
        '',
        `**Pity Preferences:**`,
        `• **Events:** ${events.codes.length ? events.codes.map(c => `\`${c}\``).join(', ') : '*None*'} (in ${events.until} packs)`,
        `• **Monthlies:** ${monthlies.codes.length ? monthlies.codes.map(c => `\`${c}\``).join(', ') : '*None*'} (in ${monthlies.until} packs)`
      ].join('\n'));

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};