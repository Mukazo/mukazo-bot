const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const CardInventory = require('../../models/CardInventory');
const randomCardFromVersion = require('../../utils/randomCardFromVersion');
const pickVersion = require('../../utils/versionPicker');
const cooldowns = require('../../utils/cooldownManager');
const handleReminders = require('../../utils/reminderHandler');
const generateVersion = require('../../utils/generateVersion');

const COST = 50;
const COMMAND_NAME = 'Slots';

const SYMBOLS = [
  { icon: '🪹', weight: 36 },
  { icon: '🍂', weight: 29 },
  { icon: '🌿', weight: 18 },
  { icon: '🪷', weight: 11 },
  { icon: '🍀', weight: 6 }
];

function weightedRoll(multiplier = 1) {
  const adjusted = SYMBOLS.map((s, index) => {
    // boost rarer symbols more when multiplier increases
    const rarityBoost = 1 + ((multiplier - 1) * (index / (SYMBOLS.length - 1)));
    return {
      icon: s.icon,
      weight: s.weight * rarityBoost,
    };
  });

  const total = adjusted.reduce((sum, s) => sum + s.weight, 0);
  const rng = Math.random() * total;

  let cumulative = 0;
  for (const s of adjusted) {
    cumulative += s.weight;
    if (rng <= cumulative) return s.icon;
  }

  return adjusted[adjusted.length - 1].icon;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Spin the swampy slot machine'),

  async execute(interaction) {
    const userId = interaction.user.id;

    const cooldownMs = await cooldowns.getEffectiveCooldown(interaction, COMMAND_NAME);
    if (await cooldowns.isOnCooldown(userId, COMMAND_NAME)) {
      const nextTime = await cooldowns.getCooldownTimestamp(userId, COMMAND_NAME);
      return interaction.editReply({ content: `Command on cooldown! Try again in ${nextTime}.` });
    }

    await cooldowns.setCooldown(userId, COMMAND_NAME, cooldownMs);

    const user = await User.findOne({ userId });
if (!user) return interaction.editReply({ content: 'User not found.' });

const currentLossStreak = user.slotData?.lossStreak || 0;

if ((user.wirlies || 0) < COST) {
  return interaction.editReply({ content: `You need ${COST} Wirlies.` });
}

    // 🎯 Luck Boost
    let luckMultiplier = 1;
    if (currentLossStreak >= 5) luckMultiplier = 1.15;
if (currentLossStreak >= 10) luckMultiplier = 1.25;
    const final1 = weightedRoll(luckMultiplier);
    const final2 = weightedRoll(luckMultiplier);
    const final3 = weightedRoll(luckMultiplier);

    // 🎞 Animation
    const spinEmbed = new EmbedBuilder().setColor('#2f3136');

    await interaction.editReply({
      embeds: [spinEmbed.setDescription('## ₍ ᐢ.ˬ.ᐢ₎ Slot Incoming\n> 🎰 Spinning...')]
    });

    await new Promise(r => setTimeout(r, 700));

    await interaction.editReply({
      embeds: [spinEmbed.setDescription(`## ₍ ᐢ.ˬ.ᐢ₎ Slot Incoming\n> ${final1} │ 🎰 │ 🎰`)]
    });

    await new Promise(r => setTimeout(r, 800));

    await interaction.editReply({
      embeds: [spinEmbed.setDescription(`## ₍ ᐢ.ˬ.ᐢ₎ Slot Incoming\n> ${final1} │ ${final2} │ 🎰`)]
    });

    await new Promise(r => setTimeout(r, 1000));

    await interaction.editReply({
      embeds: [spinEmbed.setDescription(`## ₍ ᐢ.ˬ.ᐢ₎ Slot Incoming\n> ${final1} │ ${final2} │ ${final3}`)]
    });

    await new Promise(r => setTimeout(r, 1200));

    // 🎯 Determine rewards
    const slots = [final1, final2, final3];
    const allMatch = final1 === final2 && final2 === final3;
    const twoMatch = !allMatch && (
      final1 === final2 ||
      final2 === final3 ||
      final1 === final3
    );

    let rewardW = 0;
    let rewardK = 0;
    let rewardCard = null;

    if (allMatch) {
      if (final1 === '🍀') {
        rewardW = 4000;
        rewardK = 4;
        if (Math.random() < 0.9) {
          rewardCard = await randomCardFromVersion(5, userId);
        }
      } else if (final1 === '🪷') {
        rewardW = 1875;
        rewardK = 3;
        if (Math.random() < 0.8) {
          const version = Math.random() < 0.5 ? 5 : pickVersion();
          rewardCard = await randomCardFromVersion(version, userId);
        }
      } else if (final1 === '🌿') {
        rewardW = 1250;
        if (Math.random() < 0.7) {
            const version = Math.random() < 0.35 ? 5 : pickVersion();
          rewardCard = await randomCardFromVersion(version, userId);
        }
      } else {
  rewardW = 500;

  if (Math.random() < 0.55) {
    const version = pickVersion();
    const card = await randomCardFromVersion(version, userId);

    if (card) {
      rewardCard = card;
    }
  }
      }
    } else if (twoMatch) {
      rewardW = 325;
      if (Math.random() < 0.4) {
            rewardCard = await randomCardFromVersion(pickVersion(), userId);
        }
    }

    const nextLossStreak = (!rewardW && !rewardK && !rewardCard)
  ? currentLossStreak + 1
  : 0;

const wirliesDelta = rewardW - COST;
const keysDelta = rewardK;

if (rewardCard) {
  await CardInventory.updateOne(
    { userId, cardCode: rewardCard.cardCode },
    { $inc: { quantity: 1 } },
    { upsert: true }
  );
}

const updatedUser = await User.findOneAndUpdate(
  {
    userId,
    wirlies: { $gte: COST }, // safety check
  },
  {
    $inc: {
      wirlies: wirliesDelta,
      keys: keysDelta,
    },
    $set: {
      'slotData.lossStreak': nextLossStreak,
    },
  },
  { new: true }
);

if (!updatedUser) {
  return interaction.editReply({
    content: 'Your balance changed while spinning. Please try again.',
  });
}
    await handleReminders(interaction, COMMAND_NAME, cooldownMs);

    const rewardLines = [];

if (rewardW) {
  rewardLines.push(`• <:Wirlies:1455924065972785375> **${rewardW}**`);
}

if (rewardK) {
  rewardLines.push(`• <:Key:1456059698582392852> **${rewardK}**`);
}

if (rewardCard) {
  // Use full card object like inventory does
  const emoji =
    rewardCard.emoji && rewardCard.emoji.trim().length > 0
      ? rewardCard.emoji
      : generateVersion(rewardCard);

  rewardLines.push(
    `• **${emoji} ${rewardCard.name}** \`${rewardCard.cardCode}\``
  );
}

    const finalEmbed = new EmbedBuilder()
      .setColor('#2f3136')
      .setDescription([
        '## ₍ ᐢ.ˬ.ᐢ₎ Slot Results',
        '',
        `> ${final1} │ ${final2} │ ${final3}`,
        '',
        rewardLines.length
          ? `### You won:\n${rewardLines.join('\n')}`
          : `Nothing this time…`
      ].join('\n'));

    return interaction.editReply({ embeds: [finalEmbed] });
  }
};