const mongoose = require('mongoose');

const UserQuestAssignmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    category: { type: String, enum: ['daily', 'weekly'], required: true },

    cycleKey: { type: String, required: true }, // YYYY-MM-DD or YYYY-W##
    questKeys: [{ type: String, required: true }],

    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserQuestAssignmentSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('UserQuestAssignment', UserQuestAssignmentSchema);
