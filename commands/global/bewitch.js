const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const cooldowns = require('../../utils/cooldownManager');
const { emitQuestEvent } = require('../../utils/quest/tracker');
const handleReminders = require('../../utils/reminderHandler');

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
    const ownerId = interaction.user.id;
        const commandName = 'Bewitch';
        const cooldownMs = await cooldowns.getEffectiveCooldown(interaction, commandName);
            if (await cooldowns.isOnCooldown(ownerId, commandName)) {
              const nextTime = await cooldowns.getCooldownTimestamp(ownerId, commandName);
              return interaction.editReply({ content: `Command on cooldown! Try again ${nextTime}.` });
            }
        
            // Now that the interaction is ACKed (by handler), it's safe to start the cooldown
            await cooldowns.setCooldown(ownerId, commandName, cooldownMs);

        const userId = interaction.user.id;
    let user = await User.findOne({ userId });
    if (!user) return interaction.editReply({ content: 'User not found.', ephemeral: true });

    const rng = Math.random(); // Between 0 and 1 first 25%, then 40%, then 20%, then 15% | 0-2 , 2-6, 6-8.5, 8.5-10
    let rewards = [];

    if (rng < 0.25) {
      rewards = [];
    } else if (rng < 0.65) {
      rewards = ['wirlies'];
    } else if (rng < 0.85) {
      rewards = ['keys'];
    } else {
      rewards = ['wirlies', 'keys'];
    }

    const rewardMessages = [];

let amount = 0;
let keyAmount = 0;

if (rewards.includes('wirlies')) {
  amount = Math.floor(Math.random() * 100) + 225;
  user.wirlies += amount;
  rewardMessages.push(`<:Wirlies:1455924065972785375> **${amount}**`);
}

if (rewards.includes('keys')) {
  keyAmount = Math.random() < 0.35 ? 2 : 1;
  user.keys += keyAmount;
  rewardMessages.push(`<:Key:1456059698582392852> **${keyAmount}**`);
}

await emitQuestEvent(interaction.user.id, {
  type: 'bewitch',
  rewards: {
    wirlies: amount,
    keys: keyAmount,
  },
});

    await user.save();

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '## ₍ ᐢ.ˬ.ᐢ₎ Bewitching Results',
        '',
        rewardMessages.length
        ? `You received:\n${rewardMessages.map(r => `• ${r}`).join('\n')}`
        : 'You received nothing this time...'].filter(Boolean).join('\n'));

        await handleReminders(interaction, 'bewitch', cooldownMs);

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }
};