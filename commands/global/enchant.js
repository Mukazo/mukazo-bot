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
const generateVersion = require('../../utils/generateVersion');
const cooldowns = require('../../utils/cooldownManager');

const { giveCurrency } = require('../../utils/giveCurrency');

const CardInventory = require('../../models/CardInventory');
const SummonSession = require('../../models/SummonSession');
const User = require('../../models/User');

const ENCHANT_CATEGORIES = new Set(['monthlies', 'events', 'specials']);

function grayscaleRegion(ctx, x, y, w, h) {
  const imgData = ctx.getImageData(x, y, w, h);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imgData, x, y);
}

function buttonLabelForCard(card) {
  const MAX = 80;
  let name = card.name;

  if (name.length > MAX - 8) {
    name = name.slice(0, MAX - 9) + '…';
  }

  return `Claim ୨୧ ${name}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enchant')
    .setDescription('Spend 1 Key to choose a special card'),

  async execute(interaction) {
    const ownerId = interaction.user.id;
    const commandName = 'Enchant';
        const cooldownMs = await cooldowns.getEffectiveCooldown(interaction, commandName);
            if (await cooldowns.isOnCooldown(ownerId, commandName)) {
              const nextTime = await cooldowns.getCooldownTimestamp(ownerId, commandName);
              return interaction.editReply({ content: `Command on cooldown! Try again ${nextTime}.` });
            }
        
            // Now that the interaction is ACKed (by handler), it's safe to start the cooldown
            await cooldowns.setCooldown(ownerId, commandName, cooldownMs);

    // ✅ Check keys BEFORE spending (prevents negative keys / rollback complexity)
    const userDoc = await User.findOne({ userId: ownerId }).lean();
    const currentKeys = userDoc?.keys ?? 0;

    if (currentKeys < 1) {
      return interaction.editReply({
        content: 'You need at least <:Key:1456059698582392852> **1** to use enchant.',
      });
    }
    // Spend 1 key (sink)
    const userAfterSpend = await giveCurrency(ownerId, { keys: -1 });


/* ===========================
   PULL 3 V5 SPECIAL CARDS (SIMPLE + GUARANTEED)
=========================== */

const pool = await Card.find({
  active: true,
  batch: null, // hide unreleased
  version: 5,
  category: { $in: ['monthlies', 'events', 'specials'] },
}).lean();

if (pool.length < 3) {
  // refund key
  await giveCurrency(ownerId, { keys: 1 });

  return interaction.editReply({
    content: 'Not enough special cards are available to enchant right now.',
  });
}

const shuffled = pool.sort(() => 0.5 - Math.random());
const pulls = shuffled.slice(0, 3);

    /* ===========================
       CHECK OWNERSHIP (for grayscale)
    =========================== */
    const owned = await CardInventory.find({
      userId: ownerId,
      cardCode: { $in: pulls.map(c => c.cardCode) },
    }).lean();

    const ownedSet = new Set(owned.map(o => o.cardCode));

    /* ===========================
       CANVAS (same sizing style as summon)
    =========================== */
    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 450;
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
      } catch {
        // If image fails, leave blank region (doesn't break interaction)
      }
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: 'enchant.png',
    });

    /* ===========================
       SINGLE EMBED (match summon layout)
    =========================== */
    const fields = pulls.map(card => ({
      name: `Version — ${card.emoji || generateVersion(card)}`,
      value: [
        `**Group:** ${card.group}`,
        card.era ? `**Era:** ${card.era}` : null,
        `> **Code:** \`${card.cardCode}\``,
      ].filter(Boolean).join('\n'),
      inline: true,
    }));

    const embed = new EmbedBuilder()
      .setDescription(
        [
          '## Enchanting Has Begun . . .',
          'As your key turns into particles, 3 cards appears!',
          '> With these options choose a card to claim',
        ].join('\n')
      )
      .addFields(fields)
      .setImage('attachment://enchant.png')
      .setFooter(`Keys Remaining: ${userAfterSpend.keys}`);

    /* ===========================
       BUTTONS (owner-only enforced in handler)
    =========================== */
    const row = new ActionRowBuilder().addComponents(
      pulls.map((card, i) =>
        new ButtonBuilder()
          .setCustomId(`enchant:${i}`)
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