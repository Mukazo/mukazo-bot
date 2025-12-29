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

const CardInventory = require('../../models/CardInventory');
const SummonSession = require('../../models/SummonSession');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Summon cards and choose one'),

  async execute(interaction) {

    const ownerId = interaction.user.id;

    /* ===========================
       PULL 5 RANDOM CARDS
    =========================== */

    const pulls = [];

    for (let i = 0; i < 5; i++) {
      const version = pickVersion(); // from versionPicker.js
      const card = await randomCardFromVersion(version, ownerId);
      if (card) pulls.push(card);
    }

    if (pulls.length < 5) {
      return interaction.editReply({
        content: 'Not enough cards available to summon.',
      });
    }

    /* ===========================
       CANVAS (IMAGES ONLY)
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
      try {
        const img = await Canvas.loadImage(pulls[i].localImagePath);
        ctx.drawImage(
          img,
          i * (CARD_WIDTH + GAP),
          0,
          CARD_WIDTH,
          CARD_HEIGHT
        );
      } catch {}
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: 'summon.png',
    });

    /* ===========================
       EMBEDS
    =========================== */

    const embeds = pulls.map((card, i) => {
      const lines = [
        `**Group:** ${card.group}`,
        `**Code:** ${card.cardCode}`,
        `**Version:** ${card.versionEmoji ?? card.version}`,
      ];

      if (card.era) {
        lines.push(`**Era:** ${card.era}`);
      }

      return new EmbedBuilder()
        .setTitle(`Card ${i + 1} — ${card.name}`)
        .setDescription(lines.join('\n'))
        .setColor('Blurple');
    });

    embeds[0].setImage('attachment://summon.png');

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
      embeds,
      files: [attachment],
      components: [row],
    });

    /* ===========================
       SAVE SESSION (PERSISTENT)
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
      expiresAt: new Date(Date.now() + 60_000),
    });

    /* ===========================
       COLLECTOR (UX ONLY)
    =========================== */

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on('collect', async btn => {
      await btn.deferReply({ ephemeral: true });

      const index = Number(btn.customId.split(':')[1]);

      const session = await SummonSession.findOne({
        messageId: reply.id,
      });

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

      /* ===========================
         ATOMIC CLAIM (RACE-SAFE)
      =========================== */

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

      /* ===========================
         GRANT CARD
      =========================== */

      const cardCode = pulls[index].cardCode;

      await CardInventory.updateOne(
        { userId: btn.user.id, cardCode },
        { $inc: { quantity: 1 } },
        { upsert: true }
      );

      /* ===========================
         UI UPDATE (OPTIONALS)
      =========================== */

      row.components[index]
        .setDisabled(true)
        .setLabel('CLAIMED')
        .setStyle(ButtonStyle.Secondary);

      embeds[index]
        .setColor(0x57f287)
        .setFooter({ text: `Claimed by ${btn.user.username}` });

      await interaction.editReply({
        components: [row],
        embeds,
      });

      await btn.editReply(`You claimed **${cardCode}**`);
    });

    /* ===========================
       END / TIMEOUT HANDLING
    =========================== */

    collector.on('end', async () => {
      row.components.forEach(btn => btn.setDisabled(true));

      const allClaimed = row.components.every(b => b.data.disabled);

      await interaction.editReply({
        content: allClaimed
          ? 'All cards have been claimed.'
          : 'The summon has expired.',
        components: [row],
      });
    });
  },
};
