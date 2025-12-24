const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');
const { queue } = require('../../queue'); // adjust path if needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Manage cards')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new card')
        .addStringOption(opt => opt.setName('cardcode').setDescription('Card code').setRequired(true))
        .addStringOption(opt => opt.setName('category').setDescription('Category').setRequired(true))
        .addStringOption(opt => opt.setName('version').setDescription('Version').setRequired(true))
        .addStringOption(opt => opt.setName('group').setDescription('Group').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('Card name').setRequired(true))
        .addStringOption(opt => opt.setName('designer').setDescription('Designer').setRequired(true))
        .addBooleanOption(opt => opt.setName('active').setDescription('Is this card active?').setRequired(false))
        .addAttachmentOption(opt => opt.setName('image').setDescription('Card image').setRequired(true))
        .addStringOption(opt => opt.setName('era').setDescription('Era of the card').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji for the card').setRequired(false))
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const options = {
      cardcode: interaction.options.getString('cardcode'),
      category: interaction.options.getString('category'),
      version: interaction.options.getString('version'),
      group: interaction.options.getString('group'),
      name: interaction.options.getString('name'),
      designer: interaction.options.getString('designer'),
      active: interaction.options.getBoolean('active') ?? true,
      imageUrl: interaction.options.getAttachment('image')?.url,
      era: interaction.options.getString('era'),
      emoji: interaction.options.getString('emoji') || '',
    };

    // Prepare preview
    const embed = new EmbedBuilder()
      .setTitle(`${options.emoji} ${options.name}`)
      .setDescription(`**Code:** ${options.cardcode}\n**Category:** ${options.category}\n**Version:** ${options.version}\n**Group:** ${options.group}\n**Designer:** ${options.designer}\n**Era:** ${options.era}\n**Active:** ${options.active ? 'Yes' : 'No'}`)
      .setImage(options.imageUrl)
      .setFooter({ text: 'Confirm to create this card' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({ content: '**Preview your card:**', embeds: [embed], components: [row] });

    const buttonInt = await interaction.channel.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && ['confirm', 'cancel'].includes(i.customId),
      time: 30000,
    }).catch(() => null);

    if (!buttonInt) {
      return interaction.editReply({ content: '❌ Timed out. Please try again.', embeds: [], components: [] });
    }

    if (buttonInt.customId === 'cancel') {
      return buttonInt.update({ content: '❌ Canceled.', embeds: [], components: [] });
    }

    // Load batches
    const { CardBatch } = require('../../../models/Batch'); // adjust if needed
    const batches = await CardBatch.find({}).lean();

    if (!batches.length) {
      return buttonInt.update({ content: '⚠️ No batches found.', components: [], embeds: [] });
    }

    const batchOptions = batches.map(batch => ({
      label: batch.name,
      value: batch._id.toString(),
    }));

    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select-batch')
        .setPlaceholder('Select batch...')
        .addOptions(batchOptions)
    );

    await buttonInt.update({ content: 'Select a batch to assign this card to:', components: [select], embeds: [] });

    const selectInt = await interaction.channel.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && i.customId === 'select-batch',
      time: 30000,
    }).catch(() => null);

    if (!selectInt) {
      return interaction.editReply({ content: '❌ Timed out while selecting batch.', components: [] });
    }

    const batchId = selectInt.values[0];

    // Send to worker
    await queue.add('card-create', {
      ...options,
      batchId,
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      interactionToken: interaction.token,
      interactionId: interaction.id,
    });

    await selectInt.update({ content: '⏳ Creating card... Please wait.', components: [] });
  }
};
