const Reminder = require('../models/Reminder');

module.exports = async function handleReminders(interaction, commandName, duration) {
  const user = interaction.userData;

  const key = commandName.toLowerCase();
  const mode = user?.reminderPreferences?.get?.(key) || 'off';

  if (mode === 'off') return;

  const expiresAt = new Date(Date.now() + duration);

  const isGuild = !!interaction.guildId || interaction.inGuild?.();
  const chanId =
    mode === 'channel' && isGuild
      ? (interaction.channel?.id || interaction.channelId || null)
      : null;

  await Reminder.create({
    userId: interaction.user.id,
    channelId: chanId,
    command: key,
    expiresAt
  });
};