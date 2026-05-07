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

    // ---------- STRICT EVENT MATCHING ----------

// 1. If quest is command-specific, FORCE command matching first
if (quest.conditions?.commandName) {
  if (payload.type !== 'command') continue;
  if (payload.commandName !== quest.conditions.commandName) continue;
}

// 2. Otherwise, normal trigger matching
else {
  if (quest.trigger !== 'any' && quest.trigger !== payload.type) {
    continue;
  }
}

    // summon/card filter quests (optional)
    if (payload.type === 'summon' && payload.card) {
      if (typeof c.version === 'number' && payload.card.version !== c.version) continue;
      if (c.group && payload.card.group !== c.group) continue;
      if (c.era && payload.card.era !== c.era) continue;
    }

    if (payload.type === 'shopbuy' && payload.card) {
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

    if (payload.type === 'bewitch') {
      const wirliesEarned = Number(payload.rewards?.wirlies || 0);
      const keysEarned = Number(payload.rewards?.keys || 0);

      if (c.minWirlies != null && wirliesEarned < c.minWirlies) continue;
      if (c.minKeys != null && keysEarned < c.minKeys) continue;
    }

    // count required for progress quests
    if (typeof c.count !== 'number' || c.count <= 0) continue;

    const uq = await UserQuest.findOneAndUpdate(
      { userId, questKey: quest.key },
      { $setOnInsert: { progress: 0, goal: c.count, category: quest.category, completed: false, rewardClaimed: false } },
      { upsert: true, new: true }
    );

    if (uq.completed) continue;

    uq.goal = c.count;
    uq.progress += 1;

    if (uq.progress >= uq.goal) {
  uq.completed = true;
  uq.completedAt = new Date();
  await uq.save();

  const rewardResult = await rewards.completeQuest(userId, quest);

  await sendQuestCompletion(userId, quest, rewardResult, payload);
} else {
      await uq.save();
    }
  }
}

const dmFailedCache = new Set();

async function sendQuestCompletion(userId, quest, rewardResult, payload) {
  if (!rewardResult?.ok || rewardResult?.already) return;

  const parts = [];
  if (rewardResult.wirlies) parts.push(`<:Wirlies:1455924065972785375> ${rewardResult.wirlies}`);
  if (rewardResult.keys) parts.push(`<:Key:1456059698582392852> ${rewardResult.keys}`);

  const msg = [
    `<@${userId}> completed a quest!`,
    `> **${quest.name}**`,
    `> ${parts.join(' • ') || 'Rewards'}`
  ].join('\n');

  // 🔹 Try DM first
  if (!dmFailedCache.has(userId)) {
    try {
      const user = await require('discord.js').Client.prototype.users.fetch.call(
        payload?.client ?? global.client,
        userId
      );

      await user.send({ content: msg });
      return;
    } catch {
      dmFailedCache.add(userId);
    }
  }

  // 🔹 Fallback to channel (if available)
  if (payload?.interaction?.channel) {
    await payload.interaction.channel.send({ content: msg }).catch(() => {});
  }
}

module.exports = { emitQuestEvent };
