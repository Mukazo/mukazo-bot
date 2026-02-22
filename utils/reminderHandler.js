const Reminder = require('../models/Reminder');
const User = require('../models/User');

module.exports = async function handleReminders(interaction, commandName, duration) {
  const userId = interaction.user.id;
  const user = await User.findOne({ userId });

  if (!user) return;

  const key = commandName.toLowerCase();
  const mode = user.reminderPreferences?.get?.(key) || 'off';

  if (mode === 'off') return;

  const expiresAt = new Date(Date.now() + duration);

  const isGuild = !!interaction.guildId || interaction.inGuild?.();
  const channelId =
    mode === 'channel' && isGuild
      ? interaction.channel?.id || interaction.channelId || null
      : null;

  await Reminder.create({
    userId,
    channelId,
    command: key,
    expiresAt
  });
};