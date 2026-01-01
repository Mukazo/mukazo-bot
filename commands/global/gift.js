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
const generateVersion = require('../../utils/generateVersion');
const User = require('../../models/User');

const PAGE_SIZE = 3;

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
   Parse CARDCODE input
=========================== */
function parseCardCodes(input) {
  return input
    .split(',')
    .map(p => p.trim())
    .map(part => {
      const match = part.match(/^(.+?)(?:=\+(\d+))?$/);
      if (!match) return null;
      return {
        cardCode: match[1],
        qty: match[2] ? Number(match[2]) : 1,
      };
    })
    .filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Gift cards and/or Wirlies to another user')
    .addUserOption(o =>
      o.setName('user').setDescription('Recipient').setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName('cardcode')
        .setDescription('CARDCODE or CARDCODE=+N (comma separated)')
    )
    .addIntegerOption(o =>
      o
        .setName('wirlies')
        .setDescription('Amount of Wirlies to gift')
    ),

  async execute(interaction) {
    const senderId = interaction.user.id;
    const target = interaction.options.getUser('user');

    const cardcodeRaw = interaction.options.getString('cardcode');
    const wirlies = interaction.options.getInteger('wirlies') ?? 0;

    if (!cardcodeRaw && wirlies <= 0) {
      return interaction.editReply({
        content: 'You must gift at least cards or Wirlies.',
      });
    }

    /* ===========================
       Load data
    =========================== */
    const [inventory, cards, sender] = await Promise.all([
      CardInventory.find({ userId: senderId }).lean(),
      Card.find({ batch: null }).lean(),
      User.findOne({ userId: senderId }),
    ]);

    const invMap = new Map(inventory.map(i => [i.cardCode, i.quantity]));
    const cardMap = new Map(cards.map(c => [c.cardCode, c]));

    /* ===========================
       Parse & validate cards
    =========================== */
    const parsed = cardcodeRaw ? parseCardCodes(cardcodeRaw) : [];
    const results = [];

    for (const { cardCode, qty } of parsed) {
      const owned = invMap.get(cardCode) ?? 0;
      const card = cardMap.get(cardCode);

      if (!card) {
        return interaction.editReply({
          content: `Card not found: ${cardCode}`,
        });
      }

      if (owned < qty) {
        return interaction.editReply({
          content: `Not enough copies of ${cardCode}.`,
        });
      }

      results.push({ card, qty });
    }

    if (wirlies > 0 && sender.wirlies < wirlies) {
      return interaction.editReply({
        content: 'You do not have enough Wirlies.',
      });
    }

    /* ===========================
       Pagination (preview)
    =========================== */
    const page = 0;
    const pageResults = results.slice(0, PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

    const attachment =
      pageResults.length > 0
        ? await renderCardCanvas(pageResults.map(r => r.card))
        : null;

    /* ===========================
       Embed (grid-style)
    =========================== */
    const embed = new EmbedBuilder()
      .setTitle('Confirm Gift')
      .setDescription(
        pageResults
          .map(
            r =>
              `**${r.card.group}**\n` +
              `${r.card.emoji || r.card.versionemoji} ${r.card.name}\n` +
              `\`${r.card.cardCode}\` × **${r.qty}**`
          )
          .join('\n\n')
      )
      .setFooter({ text: `Page ${page + 1} / ${totalPages}` });

    if (attachment) embed.setImage('attachment://gift.png');

    /* ===========================
       Buttons (Prev / Confirm / Cancel / Next)
    =========================== */
    const payload = encodeURIComponent(
      JSON.stringify({
        cards: results.map(r => ({
          cardCode: r.card.cardCode,
          qty: r.qty,
        })),
        wirlies,
      })
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gift:page:${target.id}:${page - 1}:${payload}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId(`gift:confirm:${target.id}:${page}:${payload}`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('gift:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`gift:page:${target.id}:${page + 1}:${payload}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page + 1 >= totalPages)
    );

    await interaction.editReply({
      embeds: [embed],
      components: results.length ? [row] : [],
      files: attachment ? [attachment] : [],
    });
  },
};
