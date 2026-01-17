const { EmbedBuilder } = require('discord.js');
const Card = require('../../../models/Card');
const User = require('../../../models/User');

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const pack = interaction.options.getString('pack'); // Add this
    const codeInput = interaction.options.getString('codes');
    const codes = codeInput.split(',').map(c => c.trim().toUpperCase()).filter(Boolean).slice(0, 3);

    if (codes.length === 0) {
      return interaction.editReply({ content: 'You must enter at least one valid card code.', ephemeral: true });
    }

    const foundCards = await Card.find({ cardCode: { $in: codes } });

    if (foundCards.length !== codes.length) {
      return interaction.editReply({
        content: `Some card codes were not found. Valid ones: ${foundCards.map(c => c.cardCode).join(', ')}`,
        ephemeral: true
      });
    }

    const user = await User.findOne({ userId });
if (!user) return interaction.editReply({ content: 'User not found.', ephemeral: true });

if (!user.pityData) user.pityData = new Map();
const existing = user.pityData.get(pack) || {};
existing.codes = codes;
user.pityData.set(pack, existing);

await user.save();

    const embed = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle(`Pity Preference Set for ${pack.charAt(0).toUpperCase() + pack.slice(1)}`)
      .setDescription(`Your pity card codes have been set:\n${codes.map(c => `• \`${c}\``).join('\n')}`);

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }
};