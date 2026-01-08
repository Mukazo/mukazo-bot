const mongoose = require('mongoose');

const UserQuestSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    questKey: { type: String, required: true, index: true },

    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserQuestSchema.index({ userId: 1, questKey: 1 }, { unique: true });

module.exports = mongoose.model('UserQuest', UserQuestSchema);
