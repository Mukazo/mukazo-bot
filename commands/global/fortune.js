const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cooldowns = require('../../utils/cooldownManager');
const User = require('../../models/User');
const handleReminders = require('../../utils/reminderHandler');

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fortune')
    .setDescription('Test your luck and receive random rewards.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const commandName = 'Fortune';

    const cooldownMs = await cooldowns.getEffectiveCooldown(interaction, commandName);

    if (await cooldowns.isOnCooldown(userId, commandName)) {
      const nextTime = await cooldowns.getCooldownTimestamp(userId, commandName);
      return interaction.editReply({
        content: `The spirits are resting . . . Try again **${nextTime}**.`,
      });
    }

    await cooldowns.setCooldown(userId, commandName, cooldownMs);

    const user = await User.findOne({ userId });
    if (!user) {
      return interaction.editReply({ content: 'User not found.', ephemeral: true });
    }

    // 🎲 RNG logic
    const rng = Math.random();

    let wirlies = 0;
    let keys = 0;
    let outcomeText = '';

    if (rng < 0.20) {
      // 20% — Nothing
      outcomeText = 'Whispers everywhere . . but nothing happens.';
    } 
    else if (rng < 0.60) {
      // 40% — Small Wirlies
      wirlies = getRandomInt(225, 275);
      outcomeText = 'Gentle blessings fall upon you.';
    } 
    else if (rng < 0.90) {
      // 30% — Bigger Wirlies + chance key
      wirlies = getRandomInt(250, 300);
      if (Math.random() < 0.35) keys = 1;
      outcomeText = 'The beings favor you greatly.';
    } 
    else {
      // 10% — Big reward
      wirlies = getRandomInt(275, 325);
      keys = Math.random() < 0.5 ? 2 : 1;
      outcomeText = 'A graceful omen manifests!';
    }

    // Apply rewards
    user.wirlies += wirlies;
    user.keys += keys;
    await user.save();

    const rewardLines = [];
    if (wirlies) rewardLines.push(`• <:Wirlies:1455924065972785375> **${wirlies}**`);
    if (keys) rewardLines.push(`• <:Key:1456059698582392852> **${keys}**`);

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '## The Spirits Reveal . .',
        outcomeText,
        '',
        rewardLines.length
          ? `Fortune Reading Earnings > ${rewardLines.join('\n')}`
          : 'You received nothing this time...',
        '',
        `__**Balance:**__ <:Wirlies:1455924065972785375> ${user.wirlies.toLocaleString()} & <:Key:1456059698582392852> ${user.keys.toLocaleString()}`,
      ].join('\n'));

      await handleReminders(interaction, 'fortune', cooldownMs);

    return interaction.editReply({ embeds: [embed] });
  }
};