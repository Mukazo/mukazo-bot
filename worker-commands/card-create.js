// commands/subcommands/card-create.js
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const {
  AttachmentBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder
} = require('discord.js');

const Card = require('../models/Card');
const Batch = require('../models/Batch');
const generateVersion = require('../utils/generateVersion');

console.log('[LOAD] 🔁 card-create.js module loaded');

  const { hydrateWorkerInteraction } = require('../utils/hydrateWorkerInteraction');

module.exports = {
  data: { name: 'card-create' },

  async execute(interaction) {
    console.log('[CARD-CREATE] 🎯 Executing...');

    // ✅ Hydrate the interaction before using it
    await hydrateWorkerInteraction(interaction);

    try {

  if (interaction.invalidWebhook) {
    console.warn('[CARD-CREATE] ⚠️ Webhook was expired — skipping execution');
    return;
  }

  console.log('[CARD-CREATE] 🟢 Deferred reply');
} catch (e) {
  console.error('[CARD-CREATE] ❌ Failed to deferReply:', e);
  return;
}


    try {
      await interaction.editReply({ content: '✅ Worker response successful!' });
    } catch (e) {
      console.error('[CARD-CREATE] ❌ Failed to editReply:', e);
    }


    const allowedRole = process.env.CARD_CREATOR_ROLE_ID;
    if (!interaction.member.roles?.cache?.has(allowedRole)) {
      return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const opts = interaction.options;
    const cardCode = opts.getString('cardcode');
    const name = opts.getString('name');
    const category = opts.getString('category');
    const versionInput = opts.getString('version');
    const emoji = opts.getString('emoji') || null;
    const group = opts.getString('group');
    const era = opts.getString('era') || null;
    const active = opts.getBoolean('active') ?? true;
    const availableQuantity = opts.getInteger('availablequantity') ?? null;

    const d1 = opts.getUser('designer') || interaction.user;
    const d2 = opts.getUser('designer2');
    const d3 = opts.getUser('designer3');
    const designerIds = [d1, d2, d3].filter(Boolean).map(u => u.id);

    if (await Card.findOne({ cardCode })) {
      return interaction.reply({ content: `A card with code \`${cardCode}\` already exists.`, ephemeral: true });
    }

    const attachment = opts.getAttachment('image');
    const ext = path.extname(attachment.name || '.png');
    const localFilename = `${cardCode}${ext}`;

    const imageDir = path.join(__dirname, '..', '..', 'images');
    fs.mkdirSync(imageDir, { recursive: true });

    const localPath = path.join(imageDir, localFilename);
    const imageResp = await axios.get(attachment.url, { responseType: 'arraybuffer' });
    fs.writeFileSync(localPath, imageResp.data);

    const versionDisplay = generateVersion({
      version: versionInput,
      overrideEmoji: emoji || undefined
    });

    const previewEmbed = new EmbedBuilder()
      .setColor('Blurple')
      .setImage(`attachment://${localFilename}`)
      .setDescription('# Card Creation')
      .addFields(
        { name: 'Name', value: name, inline: true },
        { name: 'Code', value: cardCode, inline: true },
        { name: 'Category', value: category, inline: true },
        { name: 'Group', value: group || '—', inline: true },
        { name: 'Era', value: era || '—', inline: true },
        { name: 'Version', value: emoji || versionDisplay || '—', inline: true },
        { name: 'Designer(s)', value: designerIds.map(id => `<@${id}>`).join(', ') || 'None', inline: true },
        { name: 'Active', value: String(active), inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      embeds: [previewEmbed],
      components: [row],
      files: [new AttachmentBuilder(localPath, { name: localFilename })]
    });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
      }

      await btn.deferUpdate();

      if (btn.customId === 'cancel') {
        collector.stop('cancelled');
        return btn.editReply({ content: 'Creation cancelled.', embeds: [], components: [] });
      }

      if (btn.customId === 'confirm') {
        collector.stop('confirmed');

        const batches = await Batch.find({}).sort({ releaseAt: -1 }).lean();
        const batchOptions = batches.map(b => ({
          label: b.name,
          description: `Code: ${b.code}`,
          value: b.code
        }));

        batchOptions.unshift({ label: 'No Batch', description: 'Do not assign to a batch', value: 'null' });

        const batchRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('batch-select')
            .setPlaceholder('Select a batch')
            .addOptions(batchOptions)
        );

        await btn.editReply({
          content: 'Confirmed! Now select a batch:',
          embeds: [],
          components: [batchRow],
          files: []
        });

        const batchMsg = await btn.fetchReply();
        const batchCollector = batchMsg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 30000
        });

        batchCollector.on('collect', async sel => {
          if (sel.user.id !== interaction.user.id) {
            return sel.reply({ content: 'Only the command invoker can select a batch.', ephemeral: true });
          }

          await sel.deferUpdate();
          const selectedBatch = sel.values[0] === 'null' ? null : sel.values[0];
          const batchInfo = selectedBatch
            ? await Batch.findOne({ code: selectedBatch }).lean()
            : null;

          await Card.create({
            cardCode,
            name,
            category,
            version: versionInput,
            emoji,
            designerIds,
            localImagePath: localPath,
            active,
            availableQuantity,
            timesPulled: 0,
            group,
            era,
            batch: selectedBatch,
            deactivateAt: batchInfo?.deactivateCardsAt ?? null
          });

          await sel.editReply({
            content: `✅ \`${cardCode}\` created and assigned to batch: \`${selectedBatch || 'None'}\`!`,
            components: [],
            embeds: []
          });
        });

        batchCollector.on('end', async (_, reason) => {
          if (reason !== 'limit' && !msg.replied) {
            await interaction.followUp({
              content: 'Batch selection timed out. Card was not created.',
              ephemeral: true
            });
          }
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (!['confirmed', 'cancelled'].includes(reason)) {
        await interaction.editReply({
          content: 'Creation timed out.',
          embeds: [],
          components: []
        });
      }
    });
  }
};
