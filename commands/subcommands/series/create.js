// commands/subcommands/series/create.js
const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const { enqueueInteraction, listenForResults } = require('../../../queue');

module.exports = {
  async execute(interaction) {
    await interaction.editReply({ content: 'Loading…' });

    const opts = interaction.options;

    const payload = {
      code: opts.getString('code').toUpperCase(),
      name: opts.getString('name'),
      category: opts.getString('category'),
      description: opts.getString('description'),
      imageUrl: opts.getAttachment('image').url,
      userId: interaction.user.id
    };

    // Preview UI (same pattern as cards)
    const preview = new EmbedBuilder()
      .setTitle(`Series Preview — ${payload.code}`)
      .setDescription(payload.description ?? '—')
      .setImage(payload.imageUrl)
      .addFields(
        { name: 'Name', value: payload.name, inline: true },
        { name: 'Code', value: payload.code, inline: true }
      )
      .setColor(0x57F287);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      embeds: [preview],
      components: [row]
    });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000
    });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Only the invoker can use this.', ephemeral: true });
      }

      await btn.deferUpdate();

      if (btn.customId === 'cancel') {
        collector.stop();
        return interaction.editReply({ content: 'Cancelled.', embeds: [], components: [] });
      }

      if (btn.customId !== 'confirm') return;

      collector.stop();

      await interaction.editReply({
        content: 'Creating series…',
        embeds: [],
        components: []
      });

      const jobId = `${interaction.id}:${Date.now()}`;
      await enqueueInteraction('series-create', { jobId, ...payload });

      const unlisten = listenForResults(result => {
        if (!result || result.jobId !== jobId) return;
        unlisten();

        if (!result.ok) {
          return interaction.followUp({ content: result.error, ephemeral: true });
        }

        interaction.followUp(`✅ Series \`${payload.code}\` created.`);
      });
    });
  }
};
