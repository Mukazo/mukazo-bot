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
const CardInventory = require('../../models/CardInventory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Summon cards and choose one'),

  async execute(interaction) {
    await interaction.deferReply();

    const ownerId = interaction.user.id;

    /* ===========================
       PULL 5 RANDOM CARDS
    =========================== */

    const pulls = [];

    for (let i = 0; i < 5; i++) {
      const card = await randomCardFromVersion(ownerId);
      if (card) pulls.push(card);
    }

    if (pulls.length < 5) {
      return interaction.editReply({
        content: '❌ Not enough cards available to summon.',
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
       EMBEDS (METADATA)
    =========================== */

    const embeds = pulls.map((card, index) => {
      const lines = [
        `**Group:** ${card.group}`,
        `**Code:** ${card.cardCode}`,
        `**Version:** ${card.versionEmoji ?? card.version}`,
      ];

      if (card.era) {
        lines.push(`**Era:** ${card.era}`);
      }

      return new EmbedBuilder()
        .setTitle(`Card ${index + 1} — ${card.name}`)
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

    await interaction.editReply({
      embeds,
      files: [attachment],
      components: [row],
    });

    const message = await interaction.fetchReply();

    /* ===========================
       CLAIM STATE (FAST + SAFE)
    =========================== */

    const claimedCards = new Set();     // card indexes
    const claimedUsers = new Set();     // userIds
    let ownerHasClaimed = false;

    /* ===========================
       COLLECTOR
    =========================== */

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on('collect', async btn => {
      const userId = btn.user.id;
      const index = Number(btn.customId.split(':')[1]);

      // User already claimed
      if (claimedUsers.has(userId)) {
        return btn.reply({
          content: '❌ You already claimed a card.',
          ephemeral: true,
        });
      }

      // Card already claimed
      if (claimedCards.has(index)) {
        return btn.reply({
          content: '❌ This card has already been claimed.',
          ephemeral: true,
        });
      }

      // Lock until owner claims first
      if (!ownerHasClaimed && userId !== ownerId) {
        return btn.reply({
          content: '⏳ Wait until the summoner claims first.',
          ephemeral: true,
        });
      }

      /* ===========================
         LOCK STATE FIRST (CRITICAL)
      =========================== */

      claimedUsers.add(userId);
      claimedCards.add(index);

      if (userId === ownerId) {
        ownerHasClaimed = true;
      }

      // Disable button immediately
      row.components[index].setDisabled(true);
      await interaction.editReply({ components: [row] });

      /* ===========================
         DB WRITE
      =========================== */

      const card = pulls[index];

      await CardInventory.updateOne(
        { userId, cardCode: card.cardCode },
        { $inc: { quantity: 1 } },
        { upsert: true }
      );

      await btn.reply({
        content: `✅ You claimed **${card.cardCode}**`,
        ephemeral: true,
      });

      // End early if everyone claimed or all cards gone
      if (claimedCards.size === pulls.length) {
        collector.stop('all_claimed');
      }
    });

    /* ===========================
       END / TIMEOUT
    =========================== */

    collector.on('end', async (_, reason) => {
      row.components.forEach(btn => btn.setDisabled(true));

      let content = '⏱️ The summon has expired.';

      if (reason === 'all_claimed') {
        content = '✅ All cards have been claimed.';
      }

      await interaction.editReply({
        content,
        components: [row],
      });
    });
  },
};
