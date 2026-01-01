const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const Canvas = require('canvas');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

const PAGE_SIZE = 3;

/* ===========================
   Helpers
=========================== */
const normalize = s =>
  typeof s === 'string' ? s.toLowerCase().trim() : '';

const parseCsvLower = s =>
  (s || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);

const parseCsvNums = s => {
  if (!s) return null;
  const arr = s.split(',').map(v => Number(v.trim())).filter(Number.isFinite);
  return arr.length ? arr : null;
};

/* ===========================
   Canvas renderer (summon-style)
=========================== */
async function renderCardCanvas(cards) {
  const CARD_W = 320;
  const CARD_H = 450;
  const GAP = 15;

  const canvas = Canvas.createCanvas(
    cards.length * (CARD_W + GAP),
    CARD_H
  );
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < cards.length; i++) {
    const img = await Canvas.loadImage(cards[i].localImagePath);
    ctx.drawImage(img, i * (CARD_W + GAP), 0, CARD_W, CARD_H);
  }

  return new AttachmentBuilder(canvas.toBuffer(), { name: 'gift.png' });
}

/* ===========================
   Command
=========================== */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Gift cards (explicit or random)')
    .addUserOption(o =>
      o.setName('user').setDescription('Recipient').setRequired(true)
    )

    // Explicit
    .addStringOption(o =>
      o.setName('cardcode').setDescription('CARDCODE=+N, CARDCODE2=+N')
    )

    // Random
    .addIntegerOption(o =>
      o.setName('maxversions').setDescription('Version budget')
    )

    .addStringOption(o =>
      o
        .setName('mode')
        .setDescription('Select gifting type')
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Duplicates', value: 'duplicates' }
        )
    )

    // Filters
    .addStringOption(o => o.setName('name').setDescription('Names of cards'))
    .addStringOption(o => o.setName('group').setDescription('Groups of cards'))
    .addStringOption(o => o.setName('era').setDescription('Eras of cards'))
    .addStringOption(o => o.setName('category').setDescription('Categories of cards'))
    .addStringOption(o => o.setName('version').setDescription('Version filter (eg. 1,3,5)'))

    // Excludes
    .addStringOption(o => o.setName('exclude_name').setDescription('Exclude names'))
    .addStringOption(o => o.setName('exclude_group').setDescription('Exclude grups'))
    .addStringOption(o => o.setName('exclude_era').setDescription('Exclude eras')),

  async execute(interaction) {
    const giverId = interaction.user.id;
    const target = interaction.options.getUser('user');

    const cardcodeRaw = interaction.options.getString('cardcode');
    const maxVersions = interaction.options.getInteger('maxversions');
    const mode = interaction.options.getString('mode') ?? 'all';

    const hasCardCode = Boolean(cardcodeRaw);
    const hasFilters =
      interaction.options.getString('name') ||
      interaction.options.getString('group') ||
      interaction.options.getString('era') ||
      interaction.options.getString('category') ||
      interaction.options.getString('version') ||
      interaction.options.getString('exclude_name') ||
      interaction.options.getString('exclude_group') ||
      interaction.options.getString('exclude_era');

    /* ===========================
       Conflict rules
    =========================== */
    if (hasCardCode && hasFilters) {
      return interaction.editReply({
        content: 'You cannot use cardcode together with random filters.',
      });
    }

    if (!hasCardCode && !hasFilters) {
      return interaction.editReply({
        content:
          'Provide cardcode (explicit gift) or filters + maxversions (random gift).',
      });
    }

    if (!hasCardCode && !maxVersions) {
      return interaction.editReply({
        content: 'Random gifting requires maxversions.',
      });
    }

    /* ===========================
       Load data
    =========================== */
    const [inventory, cards] = await Promise.all([
      CardInventory.find({ userId: giverId }).lean(),
      Card.find({ batch: null }).lean(),
    ]);

    const invMap = new Map(inventory.map(i => [i.cardCode, i.quantity]));
    const cardMap = new Map(cards.map(c => [c.cardCode, c]));

    let results = [];

    /* ===========================
       EXPLICIT MODE
    =========================== */
    if (hasCardCode) {
      for (const part of cardcodeRaw.split(',').map(p => p.trim())) {
        const match = part.match(/^(.+?)=\+(\d+)$/);
        if (!match) {
          return interaction.editReply({
            content: `Invalid cardcode entry: ${part}`,
          });
        }

        const code = match[1];
        const qty = Number(match[2]);
        const owned = invMap.get(code) ?? 0;
        const card = cardMap.get(code);

        if (!card || owned < qty) {
          return interaction.editReply({
            content: `You do not own enough copies of ${code}.`,
          });
        }

        results.push({ card, qty });
      }
    }

    /* ===========================
       RANDOM MODE
    =========================== */
    if (!hasCardCode) {
      const inc = {
        name: parseCsvLower(interaction.options.getString('name')),
        group: parseCsvLower(interaction.options.getString('group')),
        era: parseCsvLower(interaction.options.getString('era')),
        category: parseCsvLower(interaction.options.getString('category')),
      };

      const exc = {
        name: parseCsvLower(interaction.options.getString('exclude_name')),
        group: parseCsvLower(interaction.options.getString('exclude_group')),
        era: parseCsvLower(interaction.options.getString('exclude_era')),
      };

      const versionList = parseCsvNums(
        interaction.options.getString('version')
      );

      const pool = [];

      for (const [code, ownedQty] of invMap.entries()) {
        const card = cardMap.get(code);
        if (!card) continue;

        const allowed =
          mode === 'duplicates'
            ? Math.max(0, ownedQty - 1)
            : ownedQty;

        if (allowed <= 0) continue;

        const name = normalize(card.name);
        const alias = normalize(card.namealias ?? '');
        const group = normalize(card.group);
        const era = normalize(card.era);
        const category = normalize(card.category);
        const version = Number(card.version);

        if (inc.group.length && !inc.group.includes(group)) continue;
        if (inc.era.length && !inc.era.includes(era)) continue;
        if (inc.category.length && !inc.category.includes(category)) continue;
        if (versionList && !versionList.includes(version)) continue;

        if (inc.name.length) {
          if (!inc.name.some(q => name.includes(q) || alias.includes(q))) continue;
        }

        if (exc.group.length && exc.group.includes(group)) continue;
        if (exc.era.length && exc.era.includes(era)) continue;
        if (exc.name.length) {
          if (exc.name.some(q => name.includes(q) || alias.includes(q))) continue;
        }

        for (let i = 0; i < allowed; i++) {
          pool.push({ card, version });
        }
      }

      if (!pool.length) {
        return interaction.editReply({
          content: 'No cards match your filters.',
        });
      }

      // Shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      let spent = 0;
      const picked = [];

      for (const item of pool) {
        if (spent + item.version > maxVersions) continue;
        spent += item.version;
        picked.push(item);
        if (spent >= maxVersions) break;
      }

      const map = {};
      for (const p of picked) {
        map[p.card.cardCode] = (map[p.card.cardCode] ?? 0) + 1;
      }

      results = Object.entries(map).map(([_, qty], i) => ({
        card: picked[i].card,
        qty,
      }));
    }

    /* ===========================
       PAGINATION (random only)
    =========================== */
    const page = 0;
    const pageResults = hasCardCode
      ? results
      : results.slice(0, PAGE_SIZE);

    const attachment = await renderCardCanvas(
      pageResults.map(r => r.card)
    );

    const embed = new EmbedBuilder()
      .setTitle('Confirm Gift')
      .setDescription(
        pageResults.map(r => `• \`${r.card.cardCode}\` × ${r.qty}`).join('\n')
      )
      .setImage('attachment://gift.png');

    const payload = encodeURIComponent(
      JSON.stringify({
        cards: results.map(r => ({
          cardCode: r.card.cardCode,
          qty: r.qty,
          card: { cardCode: r.card.cardCode },
        })),
      })
    );

    const row = new ActionRowBuilder().addComponents(
      !hasCardCode &&
        new ButtonBuilder()
          .setCustomId(`gift:page:${target.id}:${page - 1}:${payload}`)
          .setLabel(' • Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),

      new ButtonBuilder()
        .setCustomId(
          hasCardCode
            ? `gift:confirm:${target.id}:${payload}`
            : `gift:confirm:${target.id}:${page}:${payload}`
        )
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),

      !hasCardCode &&
        new ButtonBuilder()
          .setCustomId(`gift:page:${target.id}:${page + 1}:${payload}`)
          .setLabel('Next •')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(results.length <= PAGE_SIZE),
    ).components.filter(Boolean);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
      files: [attachment],
    });
  },
};
