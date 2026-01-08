const mongoose = require('mongoose');

const UserQuestAssignmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  category: { type: String, enum: ['daily', 'weekly'], required: true },
  cycleKey: { type: String, required: true },
  questKeys: [{ type: String, required: true }],
  assignedAt: { type: Date, default: Date.now },
});

UserQuestAssignmentSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('UserQuestAssignment', UserQuestAssignmentSchema);
