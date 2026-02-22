const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const CardInventory = require('../../models/CardInventory');
const randomCardFromVersion = require('../../utils/randomCardFromVersion');
const pickVersion = require('../../utils/versionPicker');
const cooldowns = require('../../utils/cooldownManager');
const handleReminders = require('../../utils/reminderHandler');

const COST = 250;
const COMMAND_NAME = 'slots';

const SYMBOLS = [
  { icon: '🪹', weight: 40 },
  { icon: '🍂', weight: 30 },
  { icon: '🌿', weight: 17 },
  { icon: '🪷', weight: 10 },
  { icon: '🍀', weight: 3 }
];

function weightedRoll(multiplier = 1) {
  const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  const rng = Math.random() * total * multiplier;

  let cumulative = 0;
  for (const s of SYMBOLS) {
    cumulative += s.weight;
    if (rng <= cumulative) return s.icon;
  }
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
      return interaction.editReply({ content: `Try again ${nextTime}.` });
    }

    await cooldowns.setCooldown(userId, COMMAND_NAME, cooldownMs);

    const user = await User.findOne({ userId });
    if (!user) return interaction.editReply({ content: 'User not found.' });

    if (!user.slotData) user.slotData = { lossStreak: 0 };

    if (user.wirlies < COST) {
      return interaction.editReply({ content: `You need ${COST} Wirlies.` });
    }

    user.wirlies -= COST;

    // 🎯 Luck Boost
    let luckMultiplier = 1;
    if (user.slotData.lossStreak >= 5) luckMultiplier = 1.1;
    if (user.slotData.lossStreak >= 10) luckMultiplier = 1.2;
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
        rewardW = 8000;
        rewardK = 10;
        if (Math.random() < 0.5) {
          rewardCard = await randomCardFromVersion(5, userId);
        }
      } else if (final1 === '🪷') {
        rewardW = 4000;
        rewardK = 5;
        if (Math.random() < 0.25) {
          const version = Math.random() < 0.4 ? 5 : pickVersion();
          rewardCard = await randomCardFromVersion(version, userId);
        }
      } else if (final1 === '🌿') {
        rewardW = 2000;
        if (Math.random() < 0.15) {
          rewardCard = await randomCardFromVersion(pickVersion(), userId);
        }
      } else {
        rewardW = 1000;
      }
    } else if (twoMatch) {
      rewardW = 500;
    }

    if (!rewardW && !rewardK && !rewardCard) {
      user.slotData.lossStreak++;
    } else {
      user.slotData.lossStreak = 0;
    }

    user.wirlies += rewardW;
    user.keys += rewardK;

    if (rewardCard) {
      await CardInventory.updateOne(
        { userId, cardCode: rewardCard.cardCode },
        { $inc: { quantity: 1 } },
        { upsert: true }
      );
    }

    await user.save();
    await handleReminders(interaction, COMMAND_NAME, cooldownMs);

    const rewardLines = [];

    if (rewardW) rewardLines.push(`• <:Wirlies:1455924065972785375> **${rewardW}**`);
    if (rewardK) rewardLines.push(`• <:Key:1456059698582392852> **${rewardK}**`);
    if (rewardCard) rewardLines.push(`• **${rewardCard.group} - ${rewardCard.name}** \`${rewardCard.cardCode}\``);

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