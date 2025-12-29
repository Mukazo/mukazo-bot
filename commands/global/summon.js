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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Summon cards and choose one'),

  async execute(interaction) {
    await interaction.deferReply();

    const ownerId = interaction.user.id;

    /* ===========================
       PULL 5 RANDOM CARDS (RETRY)
    =========================== */

    const pulls = [];
    const MAX_ATTEMPTS = 30;
    let attempts = 0;

    while (pulls.length < 5 && attempts < MAX_ATTEMPTS) {
      attempts++;

      const version = pickVersion();
      const card = await randomCardFromVersion(version, ownerId);
      if (!card) continue;

      pulls.push(card);
    }

    if (pulls.length < 5) {
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

    const CARD_WIDTH = 300;
    const CARD_HEIGHT = 420;
    const GAP = 20;

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

        if (!ownedSet.has(card.cardCode)) {
          ctx.filter = 'grayscale(100%)';
        } else {
          ctx.filter = 'none';
        }

        ctx.drawImage(img, x, 0, CARD_WIDTH, CARD_HEIGHT);
        ctx.filter = 'none';
      } catch {}
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: 'summon.png',
    });

    /* ===========================
       SINGLE EMBED
    =========================== */

    const description = pulls
      .map(card => {
        const emoji = generateVersion(card);
        return `${emoji} **${card.name}**\n\`${card.cardCode}\``;
      })
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('✨ Summon')
      .setDescription(description)
      .setColor('Blurple')
      .setImage('attachment://summon.png');

    /* ===========================
       BUTTONS
    =========================== */

    const row = new ActionRowBuilder().addComponents(
      pulls.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`summon:${i}`)
          .setLabel(`Claim ${i + 1}`)
          .setStyle(ButtonStyle.Primary)
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
      expiresAt: new Date(Date.now() + 120_000),
    });

    /* ===========================
       COLLECTOR
    =========================== */

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async btn => {
      await btn.deferReply({ ephemeral: true });

      const index = Number(btn.customId.split(':')[1]);

      const session = await SummonSession.findOne({ messageId: reply.id });
      if (!session || session.expiresAt < new Date()) {
        return btn.editReply('This summon has expired.');
      }

      if (session.cards[index].claimedBy) {
        return btn.editReply('This card was already claimed.');
      }

      if (!session.ownerHasClaimed && btn.user.id !== session.ownerId) {
        return btn.editReply('Wait until the summoner claims first.');
      }

      if (session.cards.some(c => c.claimedBy === btn.user.id)) {
        return btn.editReply('You already claimed a card.');
      }

      const result = await SummonSession.updateOne(
        {
          messageId: reply.id,
          [`cards.${index}.claimedBy`]: null,
        },
        {
          $set: {
            [`cards.${index}.claimedBy`]: btn.user.id,
            ownerHasClaimed:
              btn.user.id === session.ownerId || session.ownerHasClaimed,
          },
        }
      );

      if (result.modifiedCount === 0) {
        return btn.editReply('This card was already claimed.');
      }

      const cardCode = pulls[index].cardCode;

      await CardInventory.updateOne(
        { userId: btn.user.id, cardCode },
        { $inc: { quantity: 1 } },
        { upsert: true }
      );

      row.components[index]
        .setDisabled(true)
        .setLabel('CLAIMED')
        .setStyle(ButtonStyle.Secondary);

      await interaction.editReply({ components: [row] });
      await btn.editReply(`You claimed **${cardCode}**`);
    });

    collector.on('end', async () => {
      row.components.forEach(b => b.setDisabled(true));

      await interaction.editReply({
        content: 'The summon has expired.',
        components: [row],
      });
    });
  },
};
