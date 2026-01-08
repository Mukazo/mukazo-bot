const Quest = require('../../models/Quest');
const UserQuest = require('../../models/UserQuest');
const { ensureAssigned } = require('./assign');
const { isCompletionMet } = require('./completion');
const { completeQuest } = require('./rewards');

function matches(conditions, card) {
  if (conditions.version != null && card.version !== conditions.version) return false;
  if (conditions.group != null && card.group !== conditions.group) return false;
  if (conditions.era != null && card.era !== conditions.era) return false;
  return true;
}

async function emitQuestEvent(userId, event) {
  const now = new Date();

  await ensureAssigned(userId, 'daily');
  await ensureAssigned(userId, 'weekly');

  const quests = await Quest.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    $or: [{ type: event.type }, { type: 'any' }],
  }).lean();

  for (const quest of quests) {
    if (quest.mode === 'completion') {
      const uq = await UserQuest.findOne({ userId, questKey: quest.key }).lean();
      if (uq?.completed) continue;

      if (await isCompletionMet(userId, quest)) {
        await completeQuest(userId, quest);
      }
      continue;
    }

    if (!matches(quest.conditions, event.card)) continue;

    const uq = await UserQuest.findOneAndUpdate(
      { userId, questKey: quest.key, completed: false },
      { $inc: { progress: 1 }, $set: { updatedAt: now } },
      { upsert: true, new: true }
    );

    if (quest.conditions.count && uq.progress >= quest.conditions.count) {
      await completeQuest(userId, quest);
    }
  }
}

module.exports = { emitQuestEvent };
