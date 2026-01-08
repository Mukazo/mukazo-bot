const Quest = require('../../models/Quest');
const UserQuestAssignment = require('../../models/UserQuestAssignment');
const UserQuest = require('../../models/UserQuest');
const { dailyCycleKey, weeklyCycleKey } = require('./time');

function pickRandom(arr, n) {
  return arr.sort(() => 0.5 - Math.random()).slice(0, n);
}

async function ensureAssigned(userId, category, count = 3) {
  const now = new Date();
  const cycleKey = category === 'daily'
    ? dailyCycleKey(now)
    : weeklyCycleKey(now);

  const existing = await UserQuestAssignment.findOne({ userId, category }).lean();
  if (existing && existing.cycleKey === cycleKey) {
    return existing.questKeys;
  }

  const pool = await Quest.find({
    category,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  const selected = pickRandom(pool, Math.min(count, pool.length)).map(q => q.key);

  await UserQuestAssignment.findOneAndUpdate(
    { userId, category },
    { cycleKey, questKeys: selected, assignedAt: now },
    { upsert: true }
  );

  await UserQuest.deleteMany({ userId, questKey: { $in: selected } });

  return selected;
}

module.exports = { ensureAssigned };
