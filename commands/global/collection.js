const {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const Canvas = require('canvas');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

const PAGE_SIZE = 20;

function parseMulti(input) {
  if (!input) return [];

  const trimmed = input.trim();

  const match = trimmed.match(/^\((.+)\)$/);

  if (match) {
    return match[1]
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean);
  }

  return [trimmed.toLowerCase()];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your card collection with filters and visuals.')
    .addStringOption(o => o.setName('group').setDescription('Filter by group(s)'))
    .addStringOption(o => o.setName('name').setDescription('Filter by name(s)'))
    .addStringOption(o => o.setName('era').setDescription('Filter by era(s)'))
    .addStringOption(o => o.setName('version').setDescription('Filter by version(s)')),

  async execute(interaction) {
    const userId = interaction.user.id;
    const groupInput = interaction.options.getString('group') || '';
    const nameInput = interaction.options.getString('name') || '';
    const eraInput = interaction.options.getString('era') || '';
    const versionInput = interaction.options.getString('version') || '';

    const groupFilter = parseMulti(groupInput);
const nameFilter = parseMulti(nameInput);
const eraFilter = parseMulti(eraInput);

    if (!groupFilter.length && !nameFilter.length && !eraFilter.length) {
      return interaction.editReply({
        content: 'You must provide at least one filter: **group**, **name**, or **era**.',
        ephemeral: true
      });
    }

    const versionFilter = versionInput
      ? versionInput.split(',').map(v => Number(v.trim())).filter(n => Number.isFinite(n))
      : [1, 2, 3, 4, 5];
      const cardQuery = {
      batch: null,
      version: { $in: versionFilter },
    };

    if (groupFilter.length) {
  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: groupFilter.flatMap(v => ([
      { group: new RegExp(`^${escapeRegex(v)}$`, 'i') },
      { groupalias: new RegExp(`^${escapeRegex(v)}$`, 'i') },
    ]))
  });
}

    if (nameFilter.length) {
  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: nameFilter.flatMap(v => ([
      { name: new RegExp(`^${escapeRegex(v)}$`, 'i') },
      { namealias: new RegExp(`^${escapeRegex(v)}$`, 'i') },
    ]))
  });
}

    if (eraFilter.length) {
  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: eraFilter.map(v => ({
      era: new RegExp(`^${escapeRegex(v)}$`, 'i')
    }))
  });
}

    const [filtered, ownedCards] = await Promise.all([
      Card.find(cardQuery).lean(),
      CardInventory.find({ userId, quantity: { $gt: 0 } }).lean(),
    ]);

    const ownedMap = new Map(ownedCards.map(c => [c.cardCode, c.quantity]));

    filtered.sort((a, b) => {
      const verA = Number(a.version) || 0;
      const verB = Number(b.version) || 0;
      if (verA !== verB) return verB - verA;

      return (a.group || '').localeCompare(b.group || '') ||
             (a.name || '').localeCompare(b.name || '');
    });

    if (!filtered.length) {
      return interaction.editReply('No cards matched your filters.');
    }

    const total = filtered.length;
    const filteredCodes = new Set(filtered.map(c => c.cardCode));

    let owned = 0;
    let totalCopies = 0;

    for (const inv of ownedCards) {
      if (!filteredCodes.has(inv.cardCode)) continue;
      owned++;
      totalCopies += inv.quantity || 0;
    }

    let page = 0;
    const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);

    const buildCanvasPage = async () => {
      const pageCards = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      const perRow = 5;
      const cardW = 220;
      const cardH = 300;
      const padding = 10;
      const rows = Math.ceil(pageCards.length / perRow);

      const canvas = Canvas.createCanvas(perRow * (cardW + padding), rows * (cardH + padding));
      const ctx = canvas.getContext('2d');

      for (let i = 0; i < pageCards.length; i++) {
        const card = pageCards[i];
        const x = (i % perRow) * (cardW + padding);
        const y = Math.floor(i / perRow) * (cardH + padding);
        try {
          const img = await Canvas.loadImage(card.localImagePath);
          ctx.drawImage(img, x, y, cardW, cardH);

          if (!ownedMap.has(card.cardCode)) {
            const imgData = ctx.getImageData(x, y, cardW, cardH);
            const data = imgData.data;
            for (let j = 0; j < data.length; j += 4) {
              const gray = 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
              data[j] = data[j + 1] = data[j + 2] = gray;
              data[j + 3] = data[j + 3] * 0.5;
            }
            ctx.putImageData(imgData, x, y);
          }
        } catch {}
      }

      return new AttachmentBuilder(canvas.toBuffer(), { name: 'collection.png' });
    };

    const getEmbed = () => {
      return new EmbedBuilder()
        .setDescription([
          `### ۰ ${interaction.user}'s Collection`,
          ` **Ი︵𐑼** __Owned:__ ${owned} / __Available:__ ${total}`,
          `<:space:1455504212069842956><:space:1455504212069842956><:space:1455504212069842956><:space:1455504212069842956>__Total Copies:__ ${totalCopies}`,
          '',
          groupInput && `**Groups:** ${groupInput}`,
          nameInput && `**Names:** ${nameInput}`,
          eraInput && `**Eras:** ${eraInput}`,
          versionInput && `**Versions:** ${versionInput}`,
        ].filter(Boolean).join('\n'))
        .setImage('attachment://collection.png')
        .setFooter({ text: `Page ${page + 1} / ${maxPage + 1}` });
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel(' • Previous').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('Next • ').setStyle(ButtonStyle.Secondary)
    );

    let attachment = await buildCanvasPage();
    const msg = await interaction.editReply({
      embeds: [getEmbed()],
      files: [attachment],
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 240_000,
    });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'prev') page = Math.max(0, page - 1);
      if (btn.customId === 'next') page = Math.min(page + 1, maxPage);

      attachment = await buildCanvasPage();

      await msg.edit({
        embeds: [getEmbed()],
        files: [attachment],
        components: [row],
      }).catch(() => {});
    });

    collector.on('end', () => {
      row.components.forEach(btn => btn.setDisabled(true));
      msg.edit({ components: [row] }).catch(() => {});
    });
  }
};