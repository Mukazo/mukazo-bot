const mongoose = require('mongoose');

const UserQuestSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    questKey: { type: String, required: true, index: true },
    category: {
  type: String,
  enum: ['daily', 'weekly', 'lifetime', 'event'],
  required: true,
},

    progress: { type: Number, default: 0 },
    goal: { type: Number, default: 0 },

    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },

    rewardClaimed: { type: Boolean, default: false },
    rewardClaimedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserQuestSchema.index({ userId: 1, questKey: 1 }, { unique: true });

module.exports = mongoose.model('UserQuest', UserQuestSchema);
