const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Batch = require('../../../models/Batch');
const Card = require('../../../models/Card');

module.exports = {
  async execute(interaction) {
    const batches = await Batch.find({}).sort({ releaseAt: -1 }).lean();

    if (!batches.length) {
      return interaction.reply({ content: 'No batches found.', ephemeral: true });
    }

    // Enrich batches with card count
    const batchesWithCounts = await Promise.all(
      batches.map(async b => ({
        ...b,
        count: await Card.countDocuments({ batch: b.code })
      }))
    );

    // Pagination setup
    const pageSize = 5;
    const totalPages = Math.ceil(batchesWithCounts.length / pageSize);
    let currentPage = 0;

    const renderPage = (page) => {
      const start = page * pageSize;
      const end = start + pageSize;
      const pageItems = batchesWithCounts.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle(`All Batches (Page ${page + 1}/${totalPages})`)
        .setColor('Blue')
        .setDescription(
          pageItems.map(b =>
            `**${b.name}** \`(${b.code})\`
> ${new Date(b.releaseAt).toDateString()}
> Cards: \`${b.count}\`
${b.description || '*No description*'}`
          ).join('\n\n')
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Prev')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );

      return { embed, row };
    };

    const { embed, row } = renderPage(currentPage);
    const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This menu isn’t for you.', ephemeral: true });
      }

      await i.deferUpdate();

      if (i.customId === 'prev' && currentPage > 0) currentPage--;
      if (i.customId === 'next' && currentPage < totalPages - 1) currentPage++;

      const { embed: newEmbed, row: newRow } = renderPage(currentPage);
      await msg.edit({ embeds: [newEmbed], components: [newRow] });
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  }
};
