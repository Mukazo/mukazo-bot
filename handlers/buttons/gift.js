const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const Canvas = require('canvas');
const { enqueueInteraction } = require('../../queue');

const GiftSession = require('../../models/GiftSession');
const Card = require('../../models/Card');
const generateVersion = require('../../utils/generateVersion');
const CardInventory = require('../../models/CardInventory');

const PAGE_SIZE = 6;

/* ===========================
   Canvas renderer (preview only)
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
   Inventory-style formatter
=========================== */
function formatInventoryLine(card, qty) {
  const emoji =
    card.overrideemoji ||
    card.versionemoji ||
    generateVersion(card);

  return (
    `${emoji} **${card.group}** __${card.name}__ ${card.era ? `${card.era}` : ''}\n ×**${qty}** ✮ \`${card.cardCode}\``
  );
}

module.exports = async function giftButtonHandler(interaction) {
  if (!interaction.customId.startsWith('gift:')) return;

  await interaction.deferUpdate();

  const [, action, sessionId, pageStr] = interaction.customId.split(':');
  const page = Number(pageStr) || 0;

  const session = await GiftSession.findById(sessionId);
  if (!session) {
    return interaction.editReply({
      content: 'This gift has expired.',
      components: [],
    });
  }

  if (interaction.user.id !== session.userId) {
    return interaction.followUp({
      content: 'Only the sender can interact with this gift.',
      flags: 64,
    });
  }

  /*===========================
     CANCEL
  =========================== */
  if (action === 'cancel') {
    await GiftSession.deleteOne({ _id: sessionId });

    return interaction.editReply({
      content: 'Gift cancelled.',
      embeds: [],
      components: [],
      files: [],
    });
  }

  /* ===========================
     CONFIRM
  =========================== */
  if (action === 'confirm') {
  const hasCards = session.cards && session.cards.length > 0;
  const hasCurrency = session.wirlies > 0 || session.keys > 0;

  if (!hasCards && !hasCurrency) {
    return interaction.editReply({
      content: 'Nothing to gift.',
      components: [],
      embeds: [],
    });
  }

  const result = await enqueueInteraction('gift', {
    from: session.userId,
    to: session.targetId,
    cards: session.cards ?? [],
    wirlies: session.wirlies || 0,
    keys: session.keys || 0,
    auth: session.auth === true,
  });

  session.page = 0;
  session.resultCards = result.cards; // 🔥 store t.total cards in session
  await session.save();

  return renderSummary(interaction, session, 0, true, result.cards);
}

  /* ===========================
     PREVIEW PAGINATION
  =========================== */
  if (action === 'page') {
    session.page = page;
    await session.save();

    const slice = session.cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

const [cards, inventory] = await Promise.all([
  Card.find({ cardCode: { $in: slice.map(c => c.cardCode) } }).lean(),
  CardInventory.find({ userId: session.userId, cardCode: { $in: slice.map(c => c.cardCode) } }).lean(),
]);

const cardMap = new Map(cards.map(c => [c.cardCode, c]));
const invMap = new Map(inventory.map(i => [i.cardCode, i.quantity]));

const ordered = slice.map(s => cardMap.get(s.cardCode));

    const attachment = ordered.length > 0 && !session.auth
  ? await renderCardCanvas(ordered)
  : null;

      const descriptionLines = [];
for (let i = 0; i < ordered.length; i++) {
  const card = ordered[i];
  const qty = slice[i].qty;
  const owned = invMap.get(card.cardCode) ?? 0;
  descriptionLines.push(`${formatInventoryLine(card, qty)} Total: **${owned}**`);
}

if (session.wirlies > 0) {
  descriptionLines.push(`# + <:Wirlies:1455924065972785375> ${session.wirlies.toLocaleString()}`);
}

if (session.keys > 0) {
  descriptionLines.push(`# + <:Key:1456059698582392852> ${session.keys.toLocaleString()}`);
}

const embed = new EmbedBuilder()
  .setTitle('Confirm Gift')
  .setDescription(descriptionLines.filter(Boolean).join('\n'))
  .setFooter({
    text: `Page ${page + 1} / ${Math.ceil(
      session.cards.length / PAGE_SIZE
    )}`,
  })
  .setImage(attachment);

    if (attachment) embed.setImage('attachment://gift.png');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gift:page:${sessionId}:${page - 1}`)
        .setLabel(' • Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId(`gift:confirm:${sessionId}`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`gift:cancel:${sessionId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`gift:page:${sessionId}:${page + 1}`)
        .setLabel('Next • ')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((page + 1) * PAGE_SIZE >= session.cards.length)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
      files: attachment ? [attachment] : [],
    });
  }

  /* ===========================
     SUMMARY PAGINATION
  =========================== */
  if (action === 'summary') {
    session.page = page;
    await session.save();

    return renderSummary(interaction, session, page, false);
  }
};

/* ===========================
   SUMMARY RENDERER
=========================== */
async function renderSummary(interaction, session, page, pingRecipient, resultCards =[]) {

  if (!session.cards || session.cards.length === 0) {
  const embed = new EmbedBuilder()
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
    .setDescription('### Gift Summary');

  if (session.wirlies > 0) {
    embed.addFields({
      name: 'Wirlies',
      value: `+ <:Wirlies:1455924065972785375> ${session.wirlies.toLocaleString()}`,
      inline: true,
    });
  }

  if (session.keys > 0) {
    embed.addFields({
      name: 'Keys',
      value: `+ <:Key:1456059698582392852> ${session.keys.toLocaleString()}`,
      inline: true,
    });
  }

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });

  if (pingRecipient) {
    await interaction.followUp({
      content: `-# <@${session.targetId}> received currency!`,
    });
  }

  return;
}

  const allCardCodes = session.cards.map(c => c.cardCode);

const [cards, invDocs] = await Promise.all([
  Card.find({ cardCode: { $in: allCardCodes } }).lean(),
  CardInventory.find({ userId: session.targetId, cardCode: { $in: allCardCodes } }).lean(),
]);

const cardMap = new Map(cards.map(c => [c.cardCode, c]));
const invMap = new Map(invDocs.map(d => [d.cardCode, d.quantity]));

const slice = session.cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
const resultMap = new Map();
for (const r of resultCards) {
  resultMap.set(r.cardCode, r.total);
}

  const description = slice
  .map(s => {
    const card = cardMap.get(s.cardCode);
    if (!card) return null;
    const owned = invMap.get(s.cardCode) ?? 0;
    const total = resultMap.get(s.cardCode) ?? (owned);
return `${formatInventoryLine(card, s.qty)} Total: **${total}**`;
  })
  .filter(Boolean)
  .join('\n');

  const embed = new EmbedBuilder()
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
    .setTitle('Gift Summary')
    .setDescription(description)
    .setFooter({
      text: `Page ${page + 1} / ${Math.ceil(
        session.cards.length / PAGE_SIZE
      )}`,
    });

  if (session.wirlies > 0 && page === 0) {
    embed.addFields({
      name: 'Wirlies',
      value: `+ <:Wirlies:1455924065972785375> ${session.wirlies.toLocaleString()}`,
      inline: true,
    });
  }

  if (session.keys > 0 && page === 0) {
    embed.addFields({
      name: 'Keys',
      value: `+ <:Key:1456059698582392852> ${session.keys.toLocaleString()}`,
      inline: true,
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gift:summary:${session.id}:${page - 1}`)
      .setLabel(' • Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`gift:summary:${session.id}:${page + 1}`)
      .setLabel('Next • ')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((page + 1) * PAGE_SIZE >= session.cards.length)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row],
    files: [],
  });

  if (pingRecipient) {
    await interaction.followUp({
      content: `-# <@${session.targetId}> received a gift!`,
    });
  }
}