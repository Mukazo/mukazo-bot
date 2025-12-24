// commands/subcommands/card/create.js
const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder
} = require('discord.js');

const { enqueueInteraction, listenForResults } = require('../../../queue');

module.exports = {
  async execute(interaction) {
    await interaction.editReply({ content: 'Loading…' });

    const opts = interaction.options;

    const payload = {
      cardCode: opts.getString('cardcode'),
      name: opts.getString('name'),
      category: opts.getString('category'),
      version: opts.getString('version'),
      group: opts.getString('group'),
      era: opts.getString('era'),
      emoji: opts.getString('emoji'),
      active: opts.getBoolean('active'),
      availableQuantity: opts.getInteger('availablequantity'),
      imageUrl: opts.getAttachment('image').url,
      designerIds: [
        opts.getUser('designer')?.id,
        opts.getUser('designer2')?.id,
        opts.getUser('designer3')?.id
      ].filter(Boolean),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    };

    // Preview UI
    const preview = new EmbedBuilder()
  .setTitle(`Card Preview — ${payload.cardCode}`)
  .setColor(0x5865F2) // blurple
  .setImage(payload.imageUrl)
  .addFields(
    { name: 'Name', value: payload.name, inline: true },
    { name: 'Category', value: payload.category, inline: true },
    { name: 'Version', value: payload.version ?? '—', inline: true },
    { name: 'Group', value: payload.group ?? '—', inline: true },
    { name: 'Era', value: payload.era ?? '—', inline: true },
    {
      name: 'Designers',
      value: payload.designerIds.length
        ? payload.designerIds.map(id => `<@${id}>`).join(', ')
        : '—', inline: true
    },
    { name: 'Active', value: String(payload.active), inline: true },
    {
      name: 'Limited',
      value: payload.availableQuantity
        ? String(payload.availableQuantity)
        : 'No', inline: true
    }
  );


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
      content: null,
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
        return btn.reply({ content: 'Only the invoker can use these buttons.', ephemeral: true });
      }

      await btn.deferUpdate();

      if (btn.customId === 'cancel') {
        collector.stop('cancelled');
        return interaction.editReply({
          content: 'Cancelled.',
          embeds: [],
          components: []
        });
      }

      if (btn.customId !== 'confirm') return;

      collector.stop('confirmed');

      await interaction.editReply({
        content: '⏳ Creating card...',
        embeds: [],
        components: []
      });

      // ✅ Job correlation id (unique per interaction)
      const jobId = `${interaction.id}:${Date.now()}`;

      // ✅ enqueue worker with jobId included
      await enqueueInteraction('card-create', { jobId, ...payload });

      // ✅ listen once, then unsubscribe
      const unlisten = listenForResults(async result => {
        if (!result || result.jobId !== jobId) return;

        unlisten(); // ✅ prevents leaks + duplicate triggers

        if (!result.ok) {
          return interaction.followUp({ content: `❌ ${result.error}`, ephemeral: true });
        }

        // show batch picker
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`batch:${jobId}:${cardCode}`)
          .setPlaceholder('Select batch')
          .addOptions(
            { label: 'No Batch', value: 'null' },
            ...(result.batches ?? [])
          );

        await interaction.followUp({
          content: `✅ Created \`${result.cardCode}\`. Select a batch:`,
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      });
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          await interaction.editReply({
            content: 'Timed out.',
            embeds: [],
            components: []
          });
        } catch {}
      }
    });
  }
};
