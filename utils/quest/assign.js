const Quest = require('../../models/Quest');
const UserQuestAssignment = require('../../models/UserQuestAssignment');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getDailyKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ISO-ish week key (good enough for rotation)
function getWeeklyKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
}

function cycleKeyFor(category) {
  const now = new Date();
  return category === 'weekly' ? getWeeklyKey(now) : getDailyKey(now);
}

async function ensureAssigned(userId, category, count = 3) {
  if (!['daily', 'weekly'].includes(category)) return null;

  const cycleKey = cycleKeyFor(category);
  const existing = await UserQuestAssignment.findOne({ userId, category }).lean();

  if (existing && existing.cycleKey === cycleKey && existing.questKeys?.length) {
    return existing;
  }

  const now = new Date();

  // Only pick quests of that category that are not expired
  const pool = await Quest.find({
    category,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  // If you have fewer than count quests available, just assign what exists
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, Math.min(count, shuffled.length)).map(q => q.key);

  const doc = await UserQuestAssignment.findOneAndUpdate(
    { userId, category },
    { $set: { cycleKey, questKeys: chosen, assignedAt: new Date() } },
    { upsert: true, new: true }
  );

  return doc.toObject ? doc.toObject() : doc;
}

module.exports = { ensureAssigned };
