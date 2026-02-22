const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: String,
  command: String,
  channelId: String,
  triggerAt: Date,
  sent: { type: Boolean, default: false },
  sendAttempts: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Reminder', reminderSchema);