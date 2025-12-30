const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType,
} = require('discord.js');

const Canvas = require('canvas');

const randomCardFromVersion = require('../../utils/randomCardFromVersion');
const pickVersion = require('../../utils/versionPicker');
const generateVersion = require('../../utils/generateVersion');

const CardInventory = require('../../models/CardInventory');
const SummonSession = require('../../models/SummonSession');

function grayscaleRegion(ctx, x, y, w, h) {
  const imgData = ctx.getImageData(x, y, w, h);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // luminance formula (looks better than averaging)
    const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // alpha stays data[i+3]
  }

  ctx.putImageData(imgData, x, y);
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Summon cards and choose one'),

  async execute(interaction) {

    const ownerId = interaction.user.id;

    /* ===========================
       PULL 3 RANDOM CARDS (RETRY)
    =========================== */

    const pulls = [];
    const MAX_ATTEMPTS = 30;
    let attempts = 0;

    while (pulls.length < 3 && attempts < MAX_ATTEMPTS) {
      attempts++;

      const version = pickVersion();
      const card = await randomCardFromVersion(version, ownerId);
      if (!card) continue;

      pulls.push(card);
    }

    if (pulls.length < 3) {
      return interaction.editReply({
        content: 'Not enough eligible cards available to summon.',
      });
    }

    /* ===========================
       CHECK OWNERSHIP
    =========================== */

    const owned = await CardInventory.find({
      userId: ownerId,
      cardCode: { $in: pulls.map(c => c.cardCode) },
    }).lean();

    const ownedSet = new Set(owned.map(o => o.cardCode));

    /* ===========================
       CANVAS (GRAYSCALE IF UNOWNED)
    =========================== */

    const CARD_WIDTH = 180;
    const CARD_HEIGHT = 260;
    const GAP = 15;

    const canvas = Canvas.createCanvas(
      pulls.length * (CARD_WIDTH + GAP),
      CARD_HEIGHT
    );

    const ctx = canvas.getContext('2d');

    for (let i = 0; i < pulls.length; i++) {
      const card = pulls[i];
      const x = i * (CARD_WIDTH + GAP);

      try {
        const img = await Canvas.loadImage(card.localImagePath);

        ctx.drawImage(img, x, 0, CARD_WIDTH, CARD_HEIGHT);

        if (!ownedSet.has(card.cardCode)) {
        grayscaleRegion(ctx, x, 0, CARD_WIDTH, CARD_HEIGHT);
        }

      } catch {}
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: 'summon.png',
    });

    /* ===========================
       SINGLE EMBED
    =========================== */

    const fields = pulls.map(card => ({
  name: `Version — ${generateVersion(card)}`,
  value: [
    `**Group:** ${card.group}`,
    card.era ? `**Era:** ${card.era}` : null,
    `> **Code:** \`${card.cardCode}\``,
  ].filter(Boolean).join('\n'),
  inline: true,
}));


    const embed = new EmbedBuilder()
      .setDescription('## Summoning 3 Cards\n> Choose one of the cards below to claim, pick wisely!')
      .addFields(fields)
      .setColor('#e96163')
      .setImage('attachment://summon.png');

    /* ===========================
       BUTTONS
    =========================== */

    function buttonLabelForCard(card) {
  const MAX = 80;
  let name = card.name;

  if (name.length > MAX - 8) {
    name = name.slice(0, MAX - 9) + '…';
  }

  return `Claim ୨୧ ${name}`;
}

    const row = new ActionRowBuilder().addComponents(
      pulls.map((card, i) =>
        new ButtonBuilder()
          .setCustomId(`summon:${i}`)
          .setLabel(buttonLabelForCard(card))
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const reply = await interaction.editReply({
      embeds: [embed],
      files: [attachment],
      components: [row],
    });

    /* ===========================
       SAVE SESSION
    =========================== */

    await SummonSession.create({
      messageId: reply.id,
      channelId: reply.channel.id,
      guildId: interaction.guildId,
      ownerId,
      cards: pulls.map(c => ({
        cardCode: c.cardCode,
        claimedBy: null,
      })),
      ownerHasClaimed: false,
      expiresAt: new Date(Date.now() + 180_000),
    });
  },
};
