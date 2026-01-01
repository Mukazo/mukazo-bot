const queue = require('../../queue');
const Canvas = require('canvas');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');

const PAGE_SIZE = 3;

/* ===========================
   Canvas re-render (same as gift)
=========================== */
async function renderCardCanvas(cards) {
  const CARD_W = 320;
  const CARD_H = 450;
  const GAP = 15;

  const shown = cards.slice(0, PAGE_SIZE);
  const canvas = Canvas.createCanvas(
    shown.length * (CARD_W + GAP),
    CARD_H
  );
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < shown.length; i++) {
    const x = i * (CARD_W + GAP);
    const img = await Canvas.loadImage(shown[i].localImagePath);
    ctx.drawImage(img, x, 0, CARD_W, CARD_H);
  }

  return new AttachmentBuilder(canvas.toBuffer(), { name: 'gift.png' });
}

module.exports = async function giftButtonHandler(interaction) {
  if (!interaction.customId.startsWith('gift:')) return;

  await interaction.deferUpdate();

  const [, action, targetId, ...rest] = interaction.customId.split(':');

  // Only original invoker can interact
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return interaction.followUp({
      content: 'Only the sender can interact with this gift.',
      ephemeral: true,
    });
  }

  /* ===========================
     CANCEL
  =========================== */
  if (action === 'cancel') {
    return interaction.editReply({
      content: '❌ Gift cancelled.',
      embeds: [],
      components: [],
      files: [],
    });
  }

  /* ===========================
     PAGINATION (random only)
  =========================== */
  if (action === 'page') {
    const page = Number(rest[0]);
    const payload = JSON.parse(decodeURIComponent(rest[1]));

    const totalPages = Math.ceil(payload.cards.length / PAGE_SIZE);
    if (page < 0 || page >= totalPages) return;

    const slice = payload.cards.slice(
      page * PAGE_SIZE,
      (page + 1) * PAGE_SIZE
    );

    const attachment = await renderCardCanvas(slice.map(c => c.card));

    const embed = new EmbedBuilder()
      .setTitle('Confirm Gift')
      .setDescription(
        slice.map(c => `• \`${c.card.cardCode}\` × ${c.qty}`).join('\n')
      )
      .setFooter({ text: `Page ${page + 1} / ${totalPages}` })
      .setImage('attachment://gift.png');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gift:page:${targetId}:${page - 1}:${rest[1]}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId(`gift:confirm:${targetId}:${page}:${rest[1]}`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`gift:page:${targetId}:${page + 1}:${rest[1]}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page + 1 >= totalPages),
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
      files: [attachment],
    });
  }

  /* ===========================
     CONFIRM
  =========================== */
  if (action === 'confirm') {
    // explicit mode has no page
    if (rest.length === 1) {
      const payload = JSON.parse(decodeURIComponent(rest[0]));

      await queue.add('gift', {
        from: interaction.user.id,
        to: targetId,
        ...payload,
      });

      return interaction.editReply({
        content: '✅ Gift sent successfully.',
        embeds: [],
        components: [],
        files: [],
      });
    }

    // random mode → confirm current page only
    const page = Number(rest[0]);
    const payload = JSON.parse(decodeURIComponent(rest[1]));

    const slice = payload.cards.slice(
      page * PAGE_SIZE,
      (page + 1) * PAGE_SIZE
    );

    await queue.add('gift', {
      from: interaction.user.id,
      to: targetId,
      mode: 'random',
      cards: slice.map(c => ({
        cardCode: c.card.cardCode,
        qty: c.qty,
      })),
    });

    return interaction.editReply({
      content: '✅ Gift sent successfully.',
      embeds: [],
      components: [],
      files: [],
    });
  }
};
