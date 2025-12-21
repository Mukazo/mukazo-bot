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

const Card = require('../../../models/Card');
const Batch = require('../../../models/Batch');
const { safeReply } = require('../../../utils/safeReply');
const generateVersion = require('../../../utils/generateVersion');

module.exports = {
  async execute(interaction) {
    try {
      const allowedRole = process.env.CARD_CREATOR_ROLE_ID;
      if (!interaction.member.roles.cache.has(allowedRole)) {
        return interaction.editReply({ content: 'You do not have permission to use this command.' });
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
        return interaction.editReply({ content: `A card with code \`${cardCode}\` already exists.` });
      }

      const attachment = opts.getAttachment('image');
      const ext = path.extname(attachment.name || '.png');
      const localFilename = `${cardCode}${ext}`;

      // Ensure the images folder exists
      const imageDir = path.join(__dirname, '..', 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      const localPath = path.join(imageDir, localFilename);

        // Download and save the image
        const imageResp = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        fs.writeFileSync(localPath, imageResp.data);

      // STEP 1: Show Batch Select Menu
      const batches = await Batch.find({}).sort({ releaseAt: -1 }).lean();
      const batchOptions = batches.map(b => ({
        label: b.name,
        description: `Code: ${b.code}`,
        value: b.code
      }));

      batchOptions.unshift({ label: 'No Batch', description: 'Do not assign to a batch', value: 'null' });

      const batchSelect = new StringSelectMenuBuilder()
        .setCustomId('batch-select')
        .setPlaceholder('Select a batch (or No Batch)')
        .addOptions(batchOptions);

      const batchRow = new ActionRowBuilder().addComponents(batchSelect);

      await safeReply(interaction, {
        content: 'Select a batch for this card:',
        components: [batchRow]
      });

      const selectMsg = await interaction.fetchReply();
      const selectCollector = selectMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 30000
      });

      let selectedBatch = null;
      await new Promise(resolve => {
        selectCollector.on('collect', async sel => {
          if (sel.user.id !== interaction.user.id) {
            return sel.reply({ content: 'Only the command invoker can choose the batch.', ephemeral: true });
          }
          await sel.deferUpdate();
          selectedBatch = sel.values[0] === 'null' ? null : sel.values[0];
          selectCollector.stop('selected');
          resolve();
        });

        selectCollector.on('end', (_, reason) => {
          if (reason !== 'selected') resolve(); // fallback
        });
      });

      // STEP 2: Create preview embed
      const versionDisplay = generateVersion({
        version: versionInput,
        overrideEmoji: emoji || undefined
      });

      const previewEmbed = new EmbedBuilder()
        .setTitle(versionDisplay)
        .setColor('Blurple')
        .setImage(`attachment://${localFilename}`)
        .addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Code', value: cardCode, inline: true },
          { name: 'Category', value: category, inline: true },
          { name: 'Group', value: group || '—', inline: true },
          { name: 'Era', value: era || '—', inline: true },
          { name: 'Batch', value: selectedBatch || '—', inline: true },
          {
            name: 'Designer(s)',
            value: (designerIds.length ? designerIds.map(id => `<@${id}>`).join(', ') : 'None'),
            inline: true
          },
          { name: 'Active', value: String(active), inline: true }
        );

      const confirmBtn = new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success);
      const cancelBtn = new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      await safeReply(interaction, {
        embeds: [previewEmbed],
        components: [row],
        files: [new AttachmentBuilder(localPath, { name: localFilename })]
      });

      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
      });

      collector.on('collect', async btn => {
        if (btn.user.id !== interaction.user.id) {
          return btn.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
        }

        const safeDefer = async () => {
          if (!btn.replied && !btn.deferred) {
            try { await btn.deferUpdate(); } catch { }
          }
        };

        if (btn.customId === 'confirm') {
          collector.stop('confirmed');
          await safeDefer();

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
            batch: selectedBatch
          });

          return interaction.editReply({
            content: `\`${cardCode}\` successfully created.`,
            embeds: [],
            components: []
          });
        }

        if (btn.customId === 'cancel') {
          collector.stop('cancelled');
          await safeDefer();
          return interaction.editReply({
            content: 'Creation cancelled.',
            embeds: [],
            components: []
          });
        }
      });

      collector.on('end', async (_, reason) => {
        if (!['confirmed', 'cancelled'].includes(reason)) {
          try {
            const reply = await interaction.fetchReply();
            if (!reply.ephemeral && !reply.deleted) {
              await safeReply(interaction, {
                content: 'Command timed out with no action.',
                embeds: [],
                components: []
              });
            }
          } catch { }
        }
      });
    } catch (err) {
      console.error('Error in /createcard:', err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: 'There was an error executing the command.',
          ephemeral: true
        });
      }
    }
  }
};
