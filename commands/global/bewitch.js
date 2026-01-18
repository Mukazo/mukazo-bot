const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const cooldowns = require('../../utils/cooldownManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bewitch')
    .setDescription('Pick a number between 1 and 10 to see what you get')
    .addStringOption(opt =>
      opt.setName('choice')
        .setDescription('Pick a number 1–10')
        .setRequired(true)
        .addChoices(
          ...Array.from({ length: 10 }, (_, i) => ({
            name: String(i + 1),
            value: String(i + 1)
          }))
        )
    ),

  async execute(interaction) {
        const userId = interaction.user.id;
        const commandName = 'Bewitch';
            const cooldownMs = await cooldowns.getEffectiveCooldown(interaction, commandName);
                if (await cooldowns.isOnCooldown(userId, commandName)) {
                  const nextTime = await cooldowns.getCooldownTimestamp(userId, commandName);
                  return interaction.editReply({ content: `Command on cooldown! Try again ${nextTime}.` });
                }
            
                // Now that the interaction is ACKed (by handler), it's safe to start the cooldown
                await cooldowns.setCooldown(ownerId, commandName, cooldownMs);

    let user = await User.findOne({ userId });
    if (!user) return interaction.editReply({ content: 'User not found.', ephemeral: true });

    const rng = Math.random(); // Between 0 and 1 first 20%, then 40%, then 25%, then 15% | 0-2 , 2-6, 6-8.5, 8.5-10
    let rewards = [];

    if (rng < 0.2) {
      rewards = [];
    } else if (rng < 0.6) {
      rewards = ['wirlies'];
    } else if (rng < 0.85) {
      rewards = ['keys'];
    } else {
      rewards = ['wirlies', 'keys'];
    }

    const rewardMessages = [];

    if (rewards.includes('wirlies')) {
      const amount = Math.floor(Math.random() * 275) + 200;
      user.wirlies += amount;
      rewardMessages.push(`<:Wirlies:1455924065972785375> **${amount}**`);
    }

    if (rewards.includes('keys')) {
  const keyAmount = Math.random() < 0.2 ? 2 : 1; // 20% chance for 2 keys
  user.keys += keyAmount;
  rewardMessages.push(`<:Key:1456059698582392852> **${keyAmount}**`);
}

    await user.save();

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '## ₍ ᐢ.ˬ.ᐢ₎ Bewitching Results',
        '',
        rewardMessages.length
        ? `You received:\n${rewardMessages.map(r => `• ${r}`).join('\n')}`
        : 'You received nothing this time...'].filter(Boolean).join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }
};