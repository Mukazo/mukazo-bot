// utils/reminderPoller.js
const Reminder = require('../models/Reminder');
const sendReminder = require('./sendReminder');

const INTERVAL_MS = Number(process.env.REMINDER_POLL_MS || 5000);
const BATCH = Number(process.env.REMINDER_BATCH || 50);

// Cap: max reminders sent per command PER poll cycle.
// Other commands are still allowed in same cycle.
const MAX_PER_COMMAND_PER_RUN = Number(process.env.REMINDER_MAX_PER_COMMAND || 5);

/**
 * Atomically claim & send reminders due at or before now.
 * Prevents duplicates if you ever run >1 worker.
 */
async function processDueReminders() {
  const now = new Date();
  const sentPerCommand = new Map();

  // Fetch up to BATCH due items
  const due = await Reminder.find({ expiresAt: { $lte: now }, claimedAt: { $exists: false } })
                            .sort({ expiresAt: 1 })
                            .limit(BATCH)
                            .lean();

  for (const r of due) {
    const cmd = String(r.command || '').toLowerCase();
    const already = sentPerCommand.get(cmd) || 0;

    // ✅ Per-command cap: skip for now (leave unclaimed so it can send next cycle)
    if (already >= MAX_PER_COMMAND_PER_RUN) continue;

    // Try to claim atomically
    const claimed = await Reminder.findOneAndUpdate(
      { _id: r._id, claimedAt: { $exists: false } },
      { $set: { claimedAt: new Date() } },
      { new: true }
    ).lean();

    if (!claimed) continue; // claimed by another loop/worker

    try {
      await sendReminder(claimed);
      sentPerCommand.set(cmd, already + 1);
    } catch (e) {
      console.warn(`[reminderPoller] send failed ${r._id}:`, e?.message || e);
      // optional: unclaim to retry later
      await Reminder.updateOne({ _id: r._id }, { $unset: { claimedAt: 1 } }).catch(()=>{});
    }
  }
}

function startReminderPoller() {
  console.log(`[reminderPoller] starting @ ${INTERVAL_MS}ms interval`);
  const timer = setInterval(processDueReminders, INTERVAL_MS);
  // run once soon after boot
  setTimeout(processDueReminders, 1500);
  return () => clearInterval(timer);
}

module.exports = { startReminderPoller };