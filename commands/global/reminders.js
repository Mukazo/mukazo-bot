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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('Toggle reminder settings for a command')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Command to configure')
        .setRequired(true)
        .addChoices(
          ...VALID_COMMANDS.map(cmd => ({
            name: cmd,
            value: cmd
          }))
        )
    )
    .addStringOption(option =>
      option.setName('remind')
        .setDescription('Where to send reminder')
        .setRequired(true)
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

    if (!user.reminderPreferences) {
      user.reminderPreferences = new Map();
    }

    user.reminderPreferences.set(command, mode);
    await user.save();

    const embed = new EmbedBuilder()
      .setTitle('Reminder Updated')
      .setDescription(
        `**${command}** reminder is now set to:\n\n` +
        (mode === 'off' ? '❌ OFF' :
         mode === 'dm' ? '📩 DM' :
         '📢 CHANNEL')
      );

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }
};