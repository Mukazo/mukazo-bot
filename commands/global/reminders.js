const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

const VALID_COMMANDS = [
  'summon',
  'bewitch',
  'fortune',
  'route',
  'daily',
  'weekly',
];

// ✨ Pretty display names (SAFE to decorate)
const COMMAND_DISPLAY = {
  pull: '─ Pull',
  bewitch: '─ Bewitch',
  fortune: '─ Fortune',
  route: '─ Route',
  daily: '─ Daily',
  weekly: '─ Weekly',
};

// 💖 Cute mode formatter
function formatMode(mode) {
  if (mode === 'dm') return 'ᵈᵐ';
  if (mode === 'channel') return 'ᶜʰᵃⁿⁿᵉˡ';
  return 'ᵒᶠᶠ';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('View or update your cooldown reminder settings')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Select a command to update')
        .setRequired(false)
        .addChoices(
          ...VALID_COMMANDS.map(cmd => ({
            name: COMMAND_DISPLAY[cmd],
            value: cmd
          }))
        )
    )
    .addStringOption(option =>
      option.setName('remind')
        .setDescription('Where should the reminder be sent?')
        .setRequired(false)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'DM', value: 'dm' },
          { name: 'Channel', value: 'channel' }
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const command = interaction.options.getString('command');
    const mode = interaction.options.getString('remind');

    const user = await User.findOne({ userId });
    if (!user) {
      return interaction.editReply({ content: 'User not found.' });
    }

    // Ensure Map exists
    if (!user.reminderPreferences) {
      user.reminderPreferences = new Map();
    }

    // 🔔 Update setting if both options provided
    if (command && mode) {
      user.reminderPreferences.set(command, mode);
      await user.save();
    }

    // 🌸 Build display
    const settingsDisplay = VALID_COMMANDS.map(cmd => {
      const current = user.reminderPreferences.get(cmd) || 'off';
      return `**${COMMAND_DISPLAY[cmd]}**\n> ${formatMode(current)}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '## ₍ ᐢ.ˬ.ᐢ₎ Reminder Settings',
        'Choose where you would like your cooldown reminders to appear!',
        '',
        settingsDisplay,
        '',
        '-# ୨ৎ You can update a setting anytime using this command!'
      ].join('\n'));

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  }
};