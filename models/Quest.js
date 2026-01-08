const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },

    name: { type: String, required: true },
    description: { type: String, required: true },

    // Rotation bucket
    category: {
      type: String,
      enum: ['daily', 'weekly', 'lifetime', 'event'],
      required: true,
    },

    // What event increments it
    // - "command" = running a command X times (summon/enchant/route/etc)
    // - "summon"/"enchant" = card-giving events
    // - "route" = currency run event
    trigger: {
      type: String,
      enum: ['summon', 'enchant', 'route', 'command', 'any'],
      required: true,
    },

    // Progress vs completion (own all)
    mode: {
      type: String,
      enum: ['progress', 'completion'],
      required: true,
    },

    // Optional chain prerequisite
    prerequisiteKey: { type: String, default: null },

    // Optional expiry
    expiresAt: { type: Date, default: null },

    // Conditions:
    // - progress: count required, plus optional filters
    // - completion: filters define the full set to own
    conditions: {
      count: { type: Number, default: null }, // required for progress
      commandName: { type: String, default: null }, // for trigger="command"
      minWirlies: { type: Number, default: null }, // for trigger="route" earn quests
      minKeys: { type: Number, default: null }, // for trigger="route" earn quests

      version: { type: Number, default: null },
      group: { type: String, default: null },
      era: { type: String, default: null },
    },

    rewards: {
      wirlies: { type: Number, default: 0 },
      keys: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quest', QuestSchema);
