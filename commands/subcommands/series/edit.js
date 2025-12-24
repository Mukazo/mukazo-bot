const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const Series = require('../../../models/Series');
const { enqueueInteraction, listenForResults } = require('../../../queue');

module.exports = {
  async execute(interaction) {
    const code = interaction.options.getString('code').toUpperCase();

    const updates = {};
    if (interaction.options.getString('name')) {
      updates.name = interaction.options.getString('name');
    }
    if (interaction.options.getString('description')) {
      updates.description = interaction.options.getString('description');
    }

    const image = interaction.options.getAttachment('image');
    if (image) {
      updates.imageUrl = image.url; // worker will handle download
    }

    const existing = await Series.findOne({ code }).lean();
    if (!existing) {
      return interaction.editReply(`❌ Series \`${code}\` not found.`);
    }

    // Preview
    const preview = new EmbedBuilder()
      .setTitle(`Edit Series — ${code}`)
      .setDescription(updates.description ?? existing.description ?? '—')
      .setImage(image?.url ?? `attachment://${existing.localImagePath}`)
      .addFields(
        { name: 'Name', value: updates.name ?? existing.name }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [preview], components: [row] });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000
    });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Not for you.', ephemeral: true });
      }

      await btn.deferUpdate();

      if (btn.customId === 'cancel') {
        collector.stop();
        return interaction.editReply({ content: 'Cancelled.', embeds: [], components: [] });
      }

      collector.stop();

      const jobId = `${interaction.id}:${Date.now()}`;
      await enqueueInteraction('series-edit', {
        jobId,
        code,
        updates
      });

      const unlisten = listenForResults(result => {
        if (result.jobId !== jobId) return;
        unlisten();

        if (!result.ok) {
          return interaction.followUp(`❌ ${result.error}`);
        }

        interaction.followUp(`✅ Series \`${code}\` updated.`);
      });
    });
  }
};
