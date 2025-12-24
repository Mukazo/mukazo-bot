// commands/subcommands/card/edit.js
const {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const Card = require('../../../models/Card');
const { enqueueInteraction, listenForResults } = require('../../../queue');
const { safeReply } = require('../../../utils/safeReply');
const generateVersion = require('../../../utils/generateVersion');

const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');

module.exports = {
  async execute(interaction) {

    /* ===========================
       FILTER HELPERS (JSON SAFE)
    =========================== */
    function multiStr(name) {
      const raw = interaction.options.getString(name);
      if (!raw) return null;

      const values = raw
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
        .map(v => `^${v}$`); // 👈 STRING, NOT RegExp

      if (values.length === 0) return null;
      if (values.length === 1) return values[0];
      return { $in: values };
    }

    function formatFilters(filters) {
      const out = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value?.$in) out[key] = value.$in;
        else out[key] = value;
      }
      return JSON.stringify(out);
    }

    /* ===========================
       BUILD FILTERS
    =========================== */
    const filters = {};

    const cardCodeFilter = multiStr('cardcode');
    if (cardCodeFilter) filters.cardCode = cardCodeFilter;

    const nameFilter = multiStr('name');
    if (nameFilter) filters.name = nameFilter;

    const categoryFilter = multiStr('category');
    if (categoryFilter) filters.category = categoryFilter;

    const eraFilter = multiStr('era');
    if (eraFilter) filters.era = eraFilter;

    const groupFilter = multiStr('group');
    if (groupFilter) filters.group = groupFilter;

    const batchFilter = multiStr('batch');
    if (batchFilter) filters.batch = batchFilter;

    if (interaction.options.getString('version')) {
      filters.version = interaction.options.getString('version');
    }

    /* ===========================
       FETCH MATCHING CARDS
    =========================== */
    const cards = await Card.find(filters).lean();
    if (!cards.length) {
      return interaction.reply({
        content: 'No cards matched those filters.',
        ephemeral: true,
      });
    }

    /* ===========================
       BUILD UPDATES
    =========================== */
    const updates = {};

    if (interaction.options.getString('setname')) updates.name = interaction.options.getString('setname');
    if (interaction.options.getString('setcategory')) updates.category = interaction.options.getString('setcategory');
    if (interaction.options.getString('setversion')) updates.version = interaction.options.getString('setversion');
    if (interaction.options.getString('setemoji')) updates.emoji = interaction.options.getString('setemoji');
    if (interaction.options.getString('setgroup')) updates.group = interaction.options.getString('setgroup');
    if (interaction.options.getString('setera')) updates.era = interaction.options.getString('setera');

    const newCode = interaction.options.getString('setcardcode');
    if (typeof newCode === 'string' && newCode.length > 0) {
      updates.cardCode = newCode;
    }

    const qty = interaction.options.getInteger('availablequantity');
    if (qty !== null) updates.availableQuantity = qty;

    const active = interaction.options.getBoolean('active');
    if (active !== null) updates.active = active;

    /* ===========================
       PREVIEW GRID
    =========================== */
    let page = 0;
    const perPage = 5;
    const totalPages = Math.ceil(cards.length / perPage);

    async function renderGrid(page) {
      const slice = cards.slice(page * perPage, page * perPage + perPage);
      const canvas = Canvas.createCanvas(slice.length * 266, 384);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#2f3136';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < slice.length; i++) {
        const card = slice[i];
        const imgPath =
          card.localImagePath && fs.existsSync(card.localImagePath)
            ? card.localImagePath
            : path.join(__dirname, '..', 'images', 'placeholder.png');

        const img = await Canvas.loadImage(imgPath);
        ctx.drawImage(img, i * 266 + 10, 0, 256, 384);
      }

      return canvas.toBuffer();
    }

    async function previewEmbed(page) {
      const buffer = await renderGrid(page);
      const attachment = new AttachmentBuilder(buffer, { name: 'preview.png' });

      return {
        embeds: [
          new EmbedBuilder()
            .setTitle(`Confirm Edit (${cards.length} cards)`)
            .setColor('Gold')
            .setDescription([
              `**Filters:** \`${formatFilters(filters)}\``,
              `**Updates:** \`${JSON.stringify(updates)}\``,
              '',
              ...cards
                .slice(page * perPage, page * perPage + perPage)
                .map(card => {
                  const v = generateVersion({
                    version: card.version,
                    overrideEmoji: card.emoji,
                  });
                  return `**${v} ${card.name}** (\`${card.cardCode}\`)`;
                }),
            ].join('\n'))
            .setImage('attachment://preview.png')
            .setFooter({ text: `Page ${page + 1} / ${totalPages}` }),
        ],
        files: [attachment],
      };
    }

    /* ===========================
       CONTROLS
    =========================== */
    const controls = (disabled = false) => [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⬅').setStyle(ButtonStyle.Secondary).setDisabled(disabled || page === 0),
        new ButtonBuilder().setCustomId('next').setLabel('➡').setStyle(ButtonStyle.Secondary).setDisabled(disabled || page === totalPages - 1),
        new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger).setDisabled(disabled)
      ),
    ];

    const first = await previewEmbed(page);
    await safeReply(interaction, { ...first, components: controls() });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'This is not your session.', ephemeral: true });
      }

      await btn.deferUpdate();

      if (btn.customId === 'next') page++;
      if (btn.customId === 'prev') page--;

      if (btn.customId === 'cancel') {
        collector.stop();
        return interaction.editReply({ content: 'Edit cancelled.', embeds: [], components: [] });
      }

      if (btn.customId === 'confirm') {
        collector.stop();

        await interaction.editReply({
          content: '⏳ Applying edits...',
          embeds: [],
          components: [],
        });

        const jobId = `${interaction.id}:${Date.now()}`;

        await enqueueInteraction('card-edit', {
          jobId,
          filters,
          updates,
        });

        const unlisten = listenForResults(result => {
          if (result.jobId !== jobId) return;
          unlisten();

          if (!result.ok) {
            return interaction.followUp(`❌ ${result.error}`);
          }

          interaction.followUp(
            `✅ Updated ${result.modifiedCount} card${result.modifiedCount !== 1 ? 's' : ''}.`
          );
        });

        return;
      }

      const data = await previewEmbed(page);
      await interaction.editReply({ ...data, components: controls() });
    });

    collector.on('end', () => {
      interaction.editReply({ components: controls(true) }).catch(() => {});
    });
  },
};
