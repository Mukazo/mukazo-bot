const mongoose = require('mongoose');

const CardLeaderboardSchema = new mongoose.Schema({
  scopeKey: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['distinct', 'copies'],
    required: true,
    index: true,
  },

  userId: { type: String, required: true, index: true },
  score: { type: Number, required: true, default: 0 },

  filters: {
    group: String,
    name: String,
    era: String,
  },

  updatedAt: { type: Date, default: Date.now },
});

CardLeaderboardSchema.index({ scopeKey: 1, type: 1, score: -1 });

module.exports = mongoose.model('CardLeaderboard', CardLeaderboardSchema);