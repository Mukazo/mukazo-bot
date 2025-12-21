const Batch = require('../../../models/Batch');
const Card = require('../../../models/Card');
const {
  EmbedBuilder,
} = require('discord.js');

module.exports = {
async execute(interaction) {

    const batches = await Batch.find({}).sort({ releaseAt: -1 }).lean();
      if (!batches.length) {
        return interaction.reply({ content: 'No batches found.', ephemeral: true });
      }

      // Get counts for each batch
  const cardCounts = await Promise.all(
    batches.map(batch => Card.countDocuments({ batch: batch.code }))
  );

      const embed = new EmbedBuilder()
        .setTitle('All Batches')
        .setColor('Blue')
        .setDescription(batches.map(b =>
          `**${b.name}** \`(${b.code})\`\n > ${b.releaseAt.toDateString()}\n > Total Cards: \`${cardCounts[i]}\`\n${b.description || '*No description*'}`
        ).join('\n\n'));

      return interaction.reply({ embeds: [embed], ephemeral: false });
    }
};