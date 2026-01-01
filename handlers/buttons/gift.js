const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const Canvas = require('canvas');
const queue = require('../../queue');
const Card = require('../../models/Card');

const PAGE_SIZE = 3;

/* ===========================
   Canvas renderer (same as gift)
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

module.exports = async function giftButtonHandler(interaction) {
  if (!interaction.customId.startsWith('gift:')) return;

  await interaction.deferUpdate();

  // Only original command user
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return interaction.followUp({
      content: 'Only the sender can interact with this gift.',
      ephemeral: true,
    });
  }

  const [, action, targetId, pageStr, payloadStr] =
    interaction.customId.split(':');

  /* ===========================
     Cancel
  =========================== */
  if (action === 'cancel') {
    return interaction.editReply({
      content: '❌ Gift cancelled.',
      embeds: [],
      components: [],
      files: [],
    });
  }

  const payload = JSON.parse(decodeURIComponent(payloadStr));
  const page = Number(pageStr) || 0;

  /* ===========================
     Pagination
  =========================== */
  if (action === 'page') {
    const cards = payload.cards;
    const totalPages = Math.ceil(cards.length / PAGE_SIZE);

    if (page < 0 || page >= totalPages) return;

    const slice = cards.slice(
      page * PAGE_SIZE,
      (page + 1) * PAGE_SIZE
    );

    const fullCards = await Card.find({
      cardCode: { $in: slice.map(c => c.cardCode) },
    }).lean();

    const map = new Map(fullCards.map(c => [c.cardCode, c]));
    const orderedCards = slice.map(c => map.get(c.cardCode));

    const attachment =
      orderedCards.length > 0
        ? await renderCardCanvas(orderedCards)
        : null;

    const embed = new EmbedBuilder()
      .setTitle('Confirm Gift')
      .setDescription(
        slice
          .map(
            r =>
              `**${map.get(r.cardCode).group}**\n` +
              `${map.get(r.cardCode).overrideemoji ||
                map.get(r.cardCode).versionemoji} ` +
              `${map.get(r.cardCode).name}\n` +
              `\`${r.cardCode}\` × **${r.qty}**`
          )
          .join('\n\n')
      )
      .setFooter({ text: `Page ${page + 1} / ${totalPages}` });

    if (attachment) embed.setImage('attachment://gift.png');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `gift:page:${targetId}:${page - 1}:${payloadStr}`
        )
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId(
          `gift:confirm:${targetId}:${page}:${payloadStr}`
        )
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(
          `gift:page:${targetId}:${page + 1}:${payloadStr}`
        )
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page + 1 >= totalPages)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
      files: attachment ? [attachment] : [],
    });
  }

  /* ===========================
     Confirm
  =========================== */
  if (action === 'confirm') {
    const slice = payload.cards.slice(
      page * PAGE_SIZE,
      (page + 1) * PAGE_SIZE
    );

    await queue.add('gift', {
      from: interaction.user.id,
      to: targetId,
      cards: slice,
      wirlies: payload.wirlies ?? 0,
    });

    return interaction.editReply({
      content: '✅ Gift sent successfully.',
      embeds: [],
      components: [],
      files: [],
    });
  }
};
