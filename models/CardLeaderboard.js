const mongoose = require('mongoose');

const CardLeaderboardSchema = new mongoose.Schema({
  scopeKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  filters: {
    group: String,
    name: String,
    era: String,
  },

  rows: [
    {
      userId: {
        type: String,
        required: true,
      },
      score: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  ],

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('CardLeaderboard', CardLeaderboardSchema);