const Quest = require('../../models/Quest');
const UserQuestAssignment = require('../../models/UserQuestAssignment');
const UserQuest = require('../../models/UserQuest');
const { dailyCycleKey, weeklyCycleKey } = require('./time');

function pickRandomUnique(arr, n) {
  const copy = arr.slice();
  copy.sort(() => 0.5 - Math.random());
  return copy.slice(0, n);
}

async function ensureAssigned(userId, category, slots = 3) {
  const now = new Date();
  const cycleKey = category === 'daily' ? dailyCycleKey(now) : weeklyCycleKey(now);

  const existing = await UserQuestAssignment.findOne({ userId, category }).lean();
  if (existing && existing.cycleKey === cycleKey) return existing.questKeys;

  const pool = await Quest.find({
    category,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  const selected = pickRandomUnique(pool, Math.min(slots, pool.length)).map(q => q.key);

  await UserQuestAssignment.findOneAndUpdate(
    { userId, category },
    { $set: { cycleKey, questKeys: selected, assignedAt: now } },
    { upsert: true }
  );

  // Reset progress for the newly assigned set
  await UserQuest.deleteMany({ userId, questKey: { $in: selected } });

  return selected;
}

module.exports = { ensureAssigned };
