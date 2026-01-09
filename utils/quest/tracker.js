const Quest = require('../../models/Quest');
const UserQuest = require('../../models/UserQuest');
const rewards = require('./rewards');

async function emitQuestEvent(userId, payload) {
  const now = new Date();

  // IMPORTANT: only count/progress quests live here
  const quests = await Quest.find({
    mode: 'count',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  for (const quest of quests) {
    const c = quest.conditions || {};

    // trigger match
    if (quest.trigger !== 'any' && quest.trigger !== payload.type) continue;

    // command quests
    if (payload.type === 'command') {
      if (c.commandName && c.commandName !== payload.commandName) continue;
    }

    // summon/card filter quests (optional)
    if (payload.type === 'summon' && payload.card) {
      if (typeof c.version === 'number' && payload.card.version !== c.version) continue;
      if (c.group && payload.card.group !== c.group) continue;
      if (c.era && payload.card.era !== c.era) continue;
    }

    // route reward gating
    if (payload.type === 'route') {
      const wirliesEarned = Number(payload.rewards?.wirlies || 0);
      const keysEarned = Number(payload.rewards?.keys || 0);

      if (c.minWirlies != null && wirliesEarned < c.minWirlies) continue;
      if (c.minKeys != null && keysEarned < c.minKeys) continue;
    }

    // count required for progress quests
    if (typeof c.count !== 'number' || c.count <= 0) continue;

    const uq = await UserQuest.findOneAndUpdate(
      { userId, questKey: quest.key },
      { $setOnInsert: { progress: 0, goal: c.count, completed: false, rewardClaimed: false } },
      { upsert: true, new: true }
    );

    if (uq.completed) continue;

    uq.goal = c.count;
    uq.progress += 1;

    if (uq.progress >= uq.goal) {
      uq.completed = true;
      uq.completedAt = new Date();
      await uq.save();

      // Auto reward
      await rewards.completeQuest(userId, quest);
    } else {
      await uq.save();
    }
  }
}

module.exports = { emitQuestEvent };
