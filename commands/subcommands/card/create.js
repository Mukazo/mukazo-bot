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
    await interaction.deferReply();
    await interaction.editReply({ content: 'Preparing preview…' });
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
      userId: interaction.user.id
    };

    const preview = new EmbedBuilder()
      .setTitle('Card Preview')
      .setDescription(payload.name)
      .setImage(payload.imageUrl);

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
      if (btn.user.id !== interaction.user.id) return;

      await btn.deferUpdate();

      if (btn.customId === 'cancel') {
        collector.stop();
        return interaction.editReply({
          content: 'Cancelled.',
          embeds: [],
          components: []
        });
      }

      if (btn.customId === 'confirm') {
        collector.stop();

        await interaction.editReply({
          content: '⏳ Creating card...',
          embeds: [],
          components: []
        });

        await enqueueInteraction('card-create', payload);
      }
    });

    // Worker result listener
    listenForResults(async result => {
      if (result.cardCode !== payload.cardCode) return;

      if (!result.ok) {
        return interaction.followUp(`❌ ${result.error}`);
      }

      // Optional: batch selection happens AFTER worker
      const menu = new StringSelectMenuBuilder()
        .setCustomId('batch')
        .setPlaceholder('Select batch')
        .addOptions(
          { label: 'No Batch', value: 'null' },
          ...result.batches
        );

      await interaction.followUp({
        content: 'Select a batch:',
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    });
  }
};
