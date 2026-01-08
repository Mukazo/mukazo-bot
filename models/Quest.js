const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },

  name: { type: String, required: true },
  description: { type: String, required: true },

  category: {
    type: String,
    enum: ['daily', 'weekly', 'lifetime', 'event'],
    required: true,
  },

  type: {
    type: String,
    enum: ['summon', 'enchant', 'claim', 'any'],
    required: true,
  },

  mode: {
    type: String,
    enum: ['progress', 'completion'],
    required: true,
  },

  prerequisite: { type: String, default: null },
  expiresAt: { type: Date, default: null },

  conditions: {
    count: { type: Number, default: null }, // progress only
    version: { type: Number, default: null },
    group: { type: String, default: null },
    era: { type: String, default: null },
  },

  rewards: {
    wirlies: { type: Number, default: 0 },
    keys: { type: Number, default: 0 },
  },
});

module.exports = mongoose.model('Quest', QuestSchema);
