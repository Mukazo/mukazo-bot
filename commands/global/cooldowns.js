const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cooldownManager = require('../../utils/cooldownManager');

const emojiMap = {
  Summon: '🔮',
};

const categories = {
  Cards: ['Summon'],
};

module.exports = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('cooldowns')
    .setDescription('View your current and available cooldowns'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const now = Date.now();

    const cooldowns = await cooldownManager.getCooldowns(userId);

    let description = '';

    for (const [category, commands] of Object.entries(categories)) {
      description += `\n## **__${category}__**\n`;

      for (const command of commands) {
        const emoji = emojiMap[command] ?? '•';
        const expires = cooldowns[command];

        if (expires && expires > now) {
          const unix = Math.floor(expires / 1000);
          description += `${emoji} 𓂃◞ **/${command.toLowerCase()}** ￤ <t:${unix}:R> \n`;
        } else {
          description += `${emoji} 𓂃◞ **/${command.toLowerCase()}** ￤ __Ready__ \n`;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        [
          '### ─⋆⋅ Command Cooldowns ⋆⋅─',
          description,
        ].join('\n\n')
      );

    await interaction.editReply({ embeds: [embed] });
  },
};