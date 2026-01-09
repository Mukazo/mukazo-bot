const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },

    name: { type: String, required: true },
    description: { type: String, required: true },

    category: {
      type: String,
      enum: ['daily', 'weekly', 'lifetime', 'event'],
      default: 'daily',
      index: true,
    },

    // For count/progress quests: 'summon', 'route', 'enchant', 'command', etc.
    // For completion quests: ignored (can be 'any')
    trigger: { type: String, enum: ['any', 'summon', 'route', 'enchant', 'command'], default: 'any', index: true },

    // 'count' = event-driven, uses emitQuestEvent increments
    // 'completion' = inventory-driven, uses scan on list
    mode: { type: String, enum: ['count', 'completion'], default: 'count', index: true },

    // Optional expiration
    expiresAt: { type: Date, default: null, index: true },

    conditions: {
      // Only used for mode:'count'
      count: { type: Number, default: null },

      // For trigger:'command' quests
      commandName: { type: String, default: null },

      // Optional filters
      version: { type: Number, default: null },
      group: { type: String, default: null },
      era: { type: String, default: null },

      // Route/currency gating per event (only for mode:'count')
      minWirlies: { type: Number, default: null },
      minKeys: { type: Number, default: null },
    },

    rewards: {
      wirlies: { type: Number, default: 0 },
      keys: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quest', QuestSchema);
