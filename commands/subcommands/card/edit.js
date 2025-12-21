const {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const Card = require('../../../models/Card');
const Batch = require('../../../models/Batch');
const CardInventory = require('../../../models/CardInventory');
const { safeReply } = require('../../../utils/safeReply');
const generateVersion = require('../../../utils/generateVersion');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');

module.exports = {
  async execute(interaction) {
    function multiStr(name) {
  const raw = interaction.options.getString(name);
  if (!raw) return null;

  const values = raw
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => new RegExp(`^${v}$`, 'i')); // exact + case-insensitive

  return values.length === 1 ? values[0] : { $in: values };
}

let finished = false;

    const filters = {};
    if (multiStr('cardcode')) filters.cardCode = multiStr('cardcode');
    if (multiStr('name')) filters.name = multiStr('name');
    if (multiStr('category')) filters.category = multiStr('category');
    if (interaction.options.getString('version')) filters.version = interaction.options.getString('version');
    if (multiStr('era')) filters.era = multiStr('era');
    if (multiStr('group')) filters.group = multiStr('group');
    if (multiStr('batch')) filters.batch = multiStr('batch');

    const cards = await Card.find(filters).lean();
    if (!cards.length) {
      return interaction.reply({ content: 'No cards matched those filters.', ephemeral: true });
    }

    const updates = {};
    if (interaction.options.getString('setname')) updates.name = interaction.options.getString('setname');
    if (interaction.options.getString('setcategory')) updates.category = interaction.options.getString('setcategory');
    if (interaction.options.getString('setversion')) updates.version = interaction.options.getString('setversion');
    if (interaction.options.getString('setemoji')) updates.emoji = interaction.options.getString('setemoji');
    if (interaction.options.getString('setgroup')) updates.group = interaction.options.getString('setgroup');
    if (interaction.options.getString('setera')) updates.era = interaction.options.getString('setera');
    if (interaction.options.getString('setcardcode')) {
  updates.cardCode = interaction.options.getString('setcardcode');
}


    const qty = interaction.options.getInteger('availablequantity');
    if (qty !== null) updates.availableQuantity = qty;

    const active = interaction.options.getBoolean('active');
    if (active !== null) updates.active = active;

    const untilStr = interaction.options.getString('until');
    if (untilStr) {
      const date = new Date(untilStr);
      if (isNaN(date)) {
        return interaction.reply({ content: '❌ Invalid until date.', ephemeral: true });
      }
      updates.deactivateAt = date;
    }

    const setBatch = interaction.options.getString('setbatch');
    if (setBatch) {
      updates.batch = setBatch === 'null' ? null : setBatch;
      if (updates.batch) {
        const batchDoc = await Batch.findOne({ code: updates.batch });
        if (batchDoc?.deactivateCardsAt && !updates.deactivateAt) {
          updates.deactivateAt = batchDoc.deactivateCardsAt;
        }
      }
    }

    const attachment = interaction.options.getAttachment('image');
    if (attachment) {
      const ext = path.extname(attachment.name || '.png');
      const filename = `${Date.now()}${ext}`;
      const dir = path.join(__dirname, '..', 'images');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fullPath = path.join(dir, filename);
      const res = await axios.get(attachment.url, { responseType: 'arraybuffer' });
      fs.writeFileSync(fullPath, res.data);
      updates.localImagePath = fullPath;
    }

    let currentPage = 0;
    const totalPages = Math.ceil(cards.length / 5);

    // ✅ CLEAN HORIZONTAL GRID (NO TEXT)
    async function renderGrid(page) {
      const slice = cards.slice(page * 5, page * 5 + 5);

      const cardWidth = 256;
      const cardHeight = 384;
      const padding = 10;
      const width = slice.length * (cardWidth + padding) + padding;
      const height = cardHeight;

      const canvas = Canvas.createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#2f3136';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < slice.length; i++) {
        const card = slice[i];
        let img;
        try {
          img = await Canvas.loadImage(fs.readFileSync(card.localImagePath));
        } catch {
          img = await Canvas.loadImage(path.join(__dirname, '..', 'images', 'placeholder.png'));
        }

        const x = padding + i * (cardWidth + padding);
        ctx.drawImage(img, x, 0, cardWidth, cardHeight);
      }

      return canvas.toBuffer();
    }

    const generatePreviewEmbed = async (page) => {
      const buffer = await renderGrid(page);
      const attachment = new AttachmentBuilder(buffer, { name: 'preview.png' });

      return {
        embeds: [
          new EmbedBuilder()
            .setTitle(`Confirm Edit (${cards.length} match${cards.length !== 1 ? 'es' : ''})`)
            .setColor('Gold')
            .setDescription([
  `**Filters:** \`${JSON.stringify(filters)}\``,
  `**Updates:** \`${JSON.stringify(updates)}\``,
  '',
  ...cards.slice(page * 5, page * 5 + 5).map(card => {
    const versionStr = generateVersion({ version: card.version, overrideEmoji: card.emoji });
    return `**${versionStr} ${card.name}** (\`${card.cardCode}\`) — ${card.category}`;
  })
].join('\n'))

            .setImage('attachment://preview.png')
            .setFooter({ text: `Page ${page + 1} / ${totalPages}` })
        ],
        files: [attachment]
      };
    };

    const components = (disable = false) => [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⬅').setStyle(ButtonStyle.Secondary).setDisabled(disable || currentPage === 0),
        new ButtonBuilder().setCustomId('next').setLabel('➡').setStyle(ButtonStyle.Secondary).setDisabled(disable || currentPage === totalPages - 1),
        new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success).setDisabled(disable),
        new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger).setDisabled(disable)
      )
    ];

    const first = await generatePreviewEmbed(currentPage);
    await safeReply(interaction, {
      embeds: first.embeds,
      components: components(),
      files: first.files
    });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'This is not your session.', ephemeral: true });
      }

      await btn.deferUpdate();

      if (btn.customId === 'next') {
        currentPage++;
      } else if (btn.customId === 'prev') {
        currentPage--;
      } else if (btn.customId === 'confirm') {
        finished = true;
  // Save old cardCodes BEFORE updating
  const oldCodes = cards.map(c => c.cardCode);

  // Update cards
  const res = await Card.updateMany(filters, { $set: updates });

  // If cardCode was changed, update inventories too
  if (updates.cardCode) {
    await CardInventory.updateMany(
      { cardCode: { $in: oldCodes } },
      { $set: { cardCode: updates.cardCode } }
    );
  }

  return interaction.editReply({
    content: `Updated ${res.modifiedCount} card${res.modifiedCount !== 1 ? 's' : ''}.`,
    embeds: [],
    components: []
  });

      } else if (btn.customId === 'cancel') {
        finished = true;
        return interaction.editReply({ content: 'Edit cancelled.', embeds: [], components: [] });
      }

      const data = await generatePreviewEmbed(currentPage);
      await interaction.editReply({ embeds: data.embeds, files: data.files, components: components() });
    });

    collector.on('end', () => {
  if (!finished) {
    interaction.editReply({ components: components(true) }).catch(() => {});
  }
});
  }
};
