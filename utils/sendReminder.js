// utils/sendReminder.js
const User = require('../models/User');
const Reminder = require('../models/Reminder');

// IMPORTANT: this assumes you expose your Discord client as global.client
// Add: global.client = client; in your index.js once you create the client.
module.exports = async function sendReminder(reminderDoc) {
  const client = global.client;
  if (!client) throw new Error('global.client not set (needed by sendReminder)');

  const { userId, channelId, command, _id } = reminderDoc;

  const user = await User.findOne({ userId });
  const mode = user?.reminderPreferences?.get?.(String(command).toLowerCase()) || 'off';

  // If user turned it off after reminder was queued, just delete it
  if (mode === 'off') {
    await Reminder.deleteOne({ _id });
    return;
  }

  const embed = {
    color: 0x2f3136,
    title: 'Command Reminder *!!*',
    description: `⊹ **${String(command)}** is now available.`,
  };

  // Ping outside embed
  const content = `<@${userId}>`;

  // Channel mode: try channel, fallback to DM if channel fails/not available
  if (mode === 'channel' && channelId) {
    try {
      const ch = await client.channels.fetch(channelId);
      if (ch) {
        await ch.send({ content, embeds: [embed] });
        await Reminder.deleteOne({ _id });
        return;
      }
    } catch {
      // fall through to DM
    }
  }

  // DM mode (or fallback)
  const u = await client.users.fetch(userId);
  await u.send({ content, embeds: [embed] });

  await Reminder.deleteOne({ _id });
};