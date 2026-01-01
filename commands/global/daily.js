const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cooldowns = require('../../utils/cooldownManager');
const cooldownConfig = require('../../utils/cooldownConfig');
const { giveCurrency } = require('../../utils/giveCurrency');
const User = require('../../models/User'); // Adjust path if needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Earn rewards once a day'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const commandName = 'Daily';
    const cooldownDuration = cooldownConfig[commandName];

    // Check cooldown
    if (await cooldowns.isOnCooldown(userId, commandName)) {
  const nextTime = await cooldowns.getCooldownTimestamp(userId, commandName);
  return interaction.editReply({ content: `Command on cooldown! Try again ${nextTime}.` });
}

    // Calculate streak logic
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    let userData = await User.findOne({ userId });
    if (!userData) {
      userData = await User.create({ userId, dailystreak: { count: 0, lastClaim: now } });
    }

    const lastClaim = new Date(userData.dailystreak?.lastClaim || 0);
    const diff = now - lastClaim;
    let streak = userData.dailystreak?.count || 0;

    if (diff < oneDay) {
      return interaction.editReply({
        content: `Try again another time, you already earned daily rewards today!`,
        
      });
    } else if (diff < oneDay * 2) {
      streak++;
    } else {
      streak = 1;
    }

    // Calculate scaling reward
    // Calculate tiered reward scaling
    function calculateDailyReward(streak) {
  const wirlies = 500 + Math.min(7500, Math.floor(streak / 10) * 250);  // +200 per 15 days, max +7500
  const keys = 1 + Math.min(4, Math.floor(streak / 30));       // +1 per 60 days, max +5
  return { wirlies, keys };
  }

    const reward = calculateDailyReward(streak);

    // Save streak data and set cooldown
    userData.dailystreak = { count: streak, lastClaim: now };
    await userData.save();
    await cooldowns.setCooldown(userId, commandName, cooldownDuration);

    // Grant currency
    const user = await giveCurrency(userId, {
  wirlies: reward.wirlies,
  keys: reward.keys,
});



    // Response embed
    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '## The Expedition',
        'You wandered into an enchanted forest,',
        'sparkles and shimmer surrounds you.',
        'Graced by their presence, the fairies',
        `give you <:Wirlies:1455924065972785375> **${reward.wirlies}** & <:Key:1456059698582392852> ${reward.keys}`,
        '',
        '',
        `> **Daily Streak:** ${streak}`,
        `> __**Balance:**__ <:Wirlies:1455924065972785375> ${user.wirlies.toLocaleString()} & <:Key:1456059698582392852> ${user.keys}`
      ].join('\n'))

    return interaction.editReply({ embeds: [embed] });
  }
};