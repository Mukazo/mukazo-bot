const mongoose = require('mongoose');

const summonSessionSchema = new mongoose.Schema({
  messageId: { type: String, unique: true, index: true },
  channelId: String,
  guildId: String,

  ownerId: { type: String, required: true },
  ownerHasClaimed: { type: Boolean, default: false },

  cards: [
    {
      cardCode: String,
      claimedBy: { type: String, default: null }, // userId
    }
  ],

  expiresAt: { type: Date, index: true },
}, { timestamps: true });

module.exports = mongoose.model('SummonSession', summonSessionSchema);
