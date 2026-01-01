const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const Canvas = require('canvas');
const queue = require('../../queue');

const GiftSession = require('../../models/GiftSession');
const Card = require('../../models/Card');
const generateVersion = require('../../utils/generateVersion');

const PAGE_SIZE = 3;

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
      ephemeral: true,
    });
  }

  if (action === 'cancel') {
    await GiftSession.deleteOne({ _id: sessionId });
    return interaction.editReply({
      content: '❌ Gift cancelled.',
      embeds: [],
      components: [],
      files: [],
    });
  }
  if (action === 'confirm') {
    const slice = session.cards.slice(
      session.page * PAGE_SIZE,
      session.page * PAGE_SIZE + PAGE_SIZE
    );

    await queue.add('gift', {
      from: session.userId,
      to: session.targetId,
      cards: slice,
      wirlies: session.wirlies,
    });

    await GiftSession.deleteOne({ _id: sessionId });

    return interaction.editReply({
      content: '✅ Gift sent successfully.',
      embeds: [],
      components: [],
      files: [],
    });
  }

  if (action === 'page') {
    session.page = page;
    await session.save();

    const slice = session.cards.slice(
      page * PAGE_SIZE,
      (page + 1) * PAGE_SIZE
    );

    const fullCards = await Card.find({
      cardCode: { $in: slice.map(c => c.cardCode) },
    }).lean();

    const map = new Map(fullCards.map(c => [c.cardCode, c]));
    const ordered = slice.map(s => map.get(s.cardCode));

    const attachment =
      ordered.length > 0 ? await renderCardCanvas(ordered) : null;

    const embed = new EmbedBuilder()
      .setTitle('Confirm Gift')
      .setDescription(
        ordered
          .map((card, i) => {
            const qty = slice[i].qty;
            const emoji =
              card.overrideemoji ||
              card.versionemoji ||
              generateVersion(card);
            return (
              `**${card.group}**\n` +
              `${emoji} ${card.name}\n` +
              `\`${card.cardCode}\` × **${qty}**`
            );
          })
          .join('\n\n')
      )
      .setFooter({
        text: `Page ${page + 1} / ${Math.ceil(
          session.cards.length / PAGE_SIZE
        )}`,
      });

    if (attachment) embed.setImage('attachment://gift.png');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gift:page:${sessionId}:${page - 1}`)
        .setLabel('◀')
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
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((page + 1) * PAGE_SIZE >= session.cards.length)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
      files: attachment ? [attachment] : [],
    });
  }
};