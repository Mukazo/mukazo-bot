const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require('discord.js');

const Canvas = require('canvas');

const cooldowns = require('../../utils/cooldownManager');
const cooldownConfig = require('../../utils/cooldownConfig');
const { giveCurrency } = require('../../utils/giveCurrency');
const handleReminders = require('../../utils/reminderHandler');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const User = require('../../models/User');
const { emitQuestEvent } = require('../../utils/quest/tracker');

const generateVersion = require('../../utils/generateVersion');

/* ===========================
   UTILS
=========================== */

function pickRandom(arr, count) {
  return arr
    .slice()
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
}

function calculateWeeklyReward(streak) {
  const wirlies = 3750 + Math.min(10000, Math.floor(streak / 2) * 750);
  const keys = 5 + Math.min(5, Math.floor(streak / 4));
  return { wirlies, keys };
}

function grayscaleRegion(ctx, x, y, w, h) {
  const imgData = ctx.getImageData(x, y, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    );
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imgData, x, y);
}

/* ===========================
   COMMAND
=========================== */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Claim your weekly rewards'),

  async execute(interaction) {
    
    const userId = interaction.user.id;
    const commandName = 'Weekly';
    const cooldownDuration = cooldownConfig[commandName];
    let user = await User.findOne({ userId });

if (!user) {
  user = await User.create({
    userId,
    enabledCategories: [],
  });
}

    if (!user || !user.enabledCategories || user.enabledCategories.length === 0) {
  return interaction.editReply({
    content: 'You have no enabled categories. Please run `/setup` first.',
  });
}

    /* ===========================
       COOLDOWN
    =========================== */
    if (await cooldowns.isOnCooldown(userId, commandName)) {
      const next = await cooldowns.getCooldownTimestamp(userId, commandName);
      return interaction.editReply({
        content: `Command on cooldown! Try again ${next}.`,
      });
    }

    /* ===========================
       STREAK LOGIC
    =========================== */
    const now = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    if (!user) user = await User.create({ userId });

    const lastClaim = new Date(user.weeklystreak?.lastClaim || 0);
    const diff = now - lastClaim;

    let streak =
      diff < oneWeek * 2
        ? (user.weeklystreak?.count || 0) + 1
        : 1;

    user.weeklystreak = { count: streak, lastClaim: now };
    await user.save();

    /* ===========================
       CARD POOLS
    =========================== */
    const enabled = user.enabledCategories;

const v5Pool = await Card.find({
  active: true,
  version: 5,
  batch: null,
  $and: [
    {
      $or: [
        { category: { $in: enabled } },
        { categoryalias: { $in: enabled } }
      ]
    },
    ...(enabled.includes('other music') ? [] : [{ categoryalias: { $ne: 'other music' } }])
  ]
}).lean();

    const v1to4Pool = await Card.find({
      active: true,
      version: { $gte: 1, $lte: 4 },
      batch: null,
      $and: [
    {
      $or: [
        { category: { $in: enabled } },
        { categoryalias: { $in: enabled } }
      ]
    },
    ...(enabled.includes('other music') ? [] : [{ categoryalias: { $ne: 'other music' } }])
  ]
    }).lean();

    if (v5Pool.length < 1 || v1to4Pool.length < 2) {
      return interaction.editReply({
        content: 'Not enough cards available for weekly rewards.',
      });
    }

    const pulls = [
      pickRandom(v5Pool, 1)[0],
      ...pickRandom(v1to4Pool, 2),
    ];

    /* ===========================
       INVENTORY UPDATE
    =========================== */
    for (const card of pulls) {
      await CardInventory.updateOne(
        { userId, cardCode: card.cardCode },
        { $inc: { quantity: 1 } },
        { upsert: true }
      );
    }

    /* ===========================
       CURRENCY
    =========================== */
    const reward = calculateWeeklyReward(streak);
    const updatedUser = await giveCurrency(userId, reward);

    await cooldowns.setCooldown(userId, commandName, cooldownDuration);

    /* ===========================
       CANVAS (SUMMON STYLE)
    =========================== */
    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 480;
    const GAP = 15;

    const canvas = Canvas.createCanvas(
      pulls.length * (CARD_WIDTH + GAP),
      CARD_HEIGHT
    );

    const ctx = canvas.getContext('2d');

    const owned = await CardInventory.find({
      userId,
      cardCode: { $in: pulls.map(c => c.cardCode) },
    }).lean();

    const ownedSet = new Set(owned.map(o => o.cardCode));

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
      name: 'weekly.png',
    });

    /* ===========================
       EMBED
    =========================== */
    const lines = pulls.map(card => {
      const emoji = card.emoji || generateVersion(card);
      const eraText = card.era ? `${card.era}` : '';
      return [
        `${emoji} **${card.group}** __${card.name}__ ${eraText} \`${card.cardCode}\``,
      ]
        .filter(Boolean)
        .join('\n');
    });

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setImage('attachment://weekly.png')
      .setDescription(
        [
          '## A Soothing Tune',
          'You start to hear humming echoes from a nearby cavern. As you approach slowly, you find an open chest with:',
          '',
          `### • <:Wirlies:1455924065972785375> ${reward.wirlies} & <:Key:1456059698582392852> ${reward.keys}`,
          ...lines.map(l => `• ${l}`),
          '',
          `> **Weekly Streak:** ${streak}`,
          `> __**Balance:**__ <:Wirlies:1455924065972785375> ${updatedUser.wirlies.toLocaleString()}  &  <:Key:1456059698582392852> ${updatedUser.keys}`,
        ].join('\n')
      );

      await emitQuestEvent(
            interaction.user.id,
            {
              type: 'command',
              commandName: 'weekly',
            },
            interaction
          );

      await handleReminders(interaction, 'weekly', cooldownDuration);

    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  },
};