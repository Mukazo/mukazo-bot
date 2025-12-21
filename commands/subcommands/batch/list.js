const Batch = require('../../../models/Batch');
const {
  EmbedBuilder,
} = require('discord.js');

module.exports = {
async execute(interaction) {

    const batches = await Batch.find({}).sort({ releaseAt: -1 }).lean();
      if (!batches.length) {
        return interaction.reply({ content: 'No batches found.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('All Batches')
        .setColor('Blue')
        .setDescription(batches.map(b =>
          `**${b.name}** \`(${b.code})\`\n ${b.releaseAt.toDateString()}\n${b.description || '*No description*'}`
        ).join('\n\n'));

      return interaction.reply({ embeds: [embed], ephemeral: false });
    }
};