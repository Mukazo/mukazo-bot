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

const CardInventory = require('../../models/CardInventory');
const User = require('../../models/User');
const { emitQuestEvent } = require('../../utils/quest/tracker');

const generateVersion = require('../../utils/generateVersion');
const { getPullPool } = require('../../utils/pullPoolCache');

/* ===========================
   UTILS
=========================== */

function pickRandom(arr, count) {
  const copy = arr.slice();
  const result = [];
  const max = Math.min(count, copy.length);

  for (let i = 0; i < max; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }

  return result;
}

function calculateWeeklyReward(streak) {
  const wirlies = 5250 + Math.min(7500, Math.floor(streak / 2) * 750);
  const keys = 8 + Math.min(7, Math.floor(streak / 4));
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
    console.time(`[weekly] total ${interaction.user.id}`);

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
    if (!user.enabledCategories || user.enabledCategories.length === 0) {
      console.timeEnd(`[weekly] total ${interaction.user.id}`);
      return interaction.editReply({
        content: 'You have no enabled categories. Please run `/setup` first.',
      });
    }

    /* ===========================
       COOLDOWN
    =========================== */
    if (await cooldowns.isOnCooldown(userId, commandName)) {
      const next = await cooldowns.getCooldownTimestamp(userId, commandName);
      console.timeEnd(`[weekly] total ${interaction.user.id}`);
      return interaction.editReply({
        content: `Command on cooldown! Try again ${next}.`,
      });
    }

    /* ===========================
       STREAK LOGIC
    =========================== */
    const now = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const lastClaim = new Date(user.weeklystreak?.lastClaim || 0);
    const diff = now - lastClaim;

    const streak =
      diff < oneWeek * 2
        ? (user.weeklystreak?.count || 0) + 1
        : 1;

    user.weeklystreak = { count: streak, lastClaim: now };
    await user.save();

    /* ===========================
       CARD POOLS (SHARED CACHE)
    =========================== */
    console.time(`[weekly] pools ${interaction.user.id}`);

    const [v5Cached, v1Cached, v2Cached, v3Cached, v4Cached] = await Promise.all([
      getPullPool(5, user),
      getPullPool(1, user),
      getPullPool(2, user),
      getPullPool(3, user),
      getPullPool(4, user),
    ]);

    const BLOCKED_WEEKLY_ERAS = [
  'Pola Pairs',
  // add more eras here whenever you want
];

    const v5Pool = v5Cached.cards.filter(card =>
  !BLOCKED_WEEKLY_ERAS.some(e =>
    new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(card.era)
  )
);
    const v1to4Pool = [
      ...v1Cached.cards,
      ...v2Cached.cards,
      ...v3Cached.cards,
      ...v4Cached.cards,
    ];

    console.timeEnd(`[weekly] pools ${interaction.user.id}`);

    if (v5Pool.length < 1 || v1to4Pool.length < 2) {
      console.timeEnd(`[weekly] total ${interaction.user.id}`);
      return interaction.editReply({
        content: 'Not enough cards available for weekly rewards.',
      });
    }

    const pulls = [
      pickRandom(v5Pool, 1)[0],
      ...pickRandom(v1to4Pool, 2),
    ];

    /* ===========================
       OWNERSHIP CHECK
    =========================== */
    console.time(`[weekly] ownership ${interaction.user.id}`);

    const owned = await CardInventory.find({
      userId,
      cardCode: { $in: pulls.map(c => c.cardCode) },
    })
      .select('cardCode quantity')
      .lean();

    const ownedSet = new Set(owned.map(o => o.cardCode));

    console.timeEnd(`[weekly] ownership ${interaction.user.id}`);

    /* ===========================
       INVENTORY UPDATE
    =========================== */
    console.time(`[weekly] inventory ${interaction.user.id}`);

    await CardInventory.bulkWrite(
      pulls.map(card => ({
        updateOne: {
          filter: { userId, cardCode: card.cardCode },
          update: { $inc: { quantity: 1 } },
          upsert: true,
        }
      }))
    );

    console.timeEnd(`[weekly] inventory ${interaction.user.id}`);

    /* ===========================
       CURRENCY
    =========================== */
    const reward = calculateWeeklyReward(streak);
    const updatedUser = await giveCurrency(userId, reward);

    await cooldowns.setCooldown(userId, commandName, cooldownDuration);

    /* ===========================
       CANVAS
    =========================== */
    console.time(`[weekly] canvas ${interaction.user.id}`);

    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 480;
    const GAP = 15;

    const canvas = Canvas.createCanvas(
      pulls.length * (CARD_WIDTH + GAP),
      CARD_HEIGHT
    );

    const ctx = canvas.getContext('2d');

    const loadedImages = await Promise.all(
      pulls.map(card =>
        Canvas.loadImage(card.localImagePath).catch(() => null)
      )
    );

    for (let i = 0; i < pulls.length; i++) {
      const card = pulls[i];
      const img = loadedImages[i];
      const x = i * (CARD_WIDTH + GAP);

      if (!img) continue;

      ctx.drawImage(img, x, 0, CARD_WIDTH, CARD_HEIGHT);
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: 'weekly.png',
    });

    console.timeEnd(`[weekly] canvas ${interaction.user.id}`);

    /* ===========================
       EMBED
    =========================== */
    const lines = pulls.map(card => {
      const emoji = card.emoji || generateVersion(card);
      const eraText = card.era ? `${card.era}` : '';
      return `${emoji} **${card.group}** __${card.name}__ ${eraText} \`${card.cardCode}\``;
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

    console.time(`[weekly] reply ${interaction.user.id}`);

    const response = await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });

    console.timeEnd(`[weekly] reply ${interaction.user.id}`);
    console.timeEnd(`[weekly] total ${interaction.user.id}`);

    return response;
  },
};