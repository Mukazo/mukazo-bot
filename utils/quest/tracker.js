const Quest = require('../../models/Quest');
const UserQuest = require('../../models/UserQuest');
const { ensureAssigned } = require('./assign');
const { isCompletionMet } = require('./completion');
const { completeQuest } = require('./rewards');

function isExpired(quest) {
  return quest.expiresAt && quest.expiresAt <= new Date();
}

async function prerequisiteMet(userId, prerequisiteKey) {
  if (!prerequisiteKey) return true;
  const uq = await UserQuest.findOne({
    userId,
    questKey: prerequisiteKey,
    completed: true,
  }).lean();
  return Boolean(uq);
}

function matchesCardFilters(conditions, card) {
  if (!card) {
    console.log('[QUEST DEBUG] No card payload');
    return false;
  }

  if (
    conditions.version != null &&
    Number(card.version) !== Number(conditions.version)
  ) {
    console.log('[QUEST DEBUG] Version mismatch', card.version, conditions.version);
    return false;
  }

  if (conditions.group != null && card.group !== conditions.group) {
    console.log('[QUEST DEBUG] Group mismatch', card.group, conditions.group);
    return false;
  }

  if (conditions.era != null && card.era !== conditions.era) {
    console.log('[QUEST DEBUG] Era mismatch', card.era, conditions.era);
    return false;
  }

  return true;
}

async function notify(interaction, text) {
  if (!interaction?.followUp) return;
  try {
    await interaction.followUp({ content: text, ephemeral: true });
  } catch {}
}

async function emitQuestEvent(userId, payload, interactionForNotify = null) {
  console.log('[QUEST DEBUG] emitQuestEvent START', {
    userId,
    type: payload?.type,
    card: payload?.card,
  });

  await ensureAssigned(userId, 'daily', 3);
  await ensureAssigned(userId, 'weekly', 3);

  const quests = await Quest.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).lean();

  console.log('[QUEST DEBUG] Quest templates found:', quests.length);

  for (const quest of quests) {
    console.log('[QUEST DEBUG] Checking quest', quest.key);

    if (isExpired(quest)) {
      console.log('[QUEST DEBUG] Skipped expired');
      continue;
    }

    if (!(await prerequisiteMet(userId, quest.prerequisiteKey))) {
      console.log('[QUEST DEBUG] Prerequisite not met');
      continue;
    }

    const trigger = quest.trigger;
    const type = payload.type;

    if (trigger !== 'any' && trigger !== type) {
      console.log('[QUEST DEBUG] Trigger mismatch', trigger, type);
      continue;
    }

    if (quest.mode === 'completion') {
      const uq = await UserQuest.findOne({ userId, questKey: quest.key }).lean();
      if (uq?.completed) continue;

      const met = await isCompletionMet(userId, quest);
      if (met) {
        await completeQuest(userId, quest);
        await notify(interactionForNotify, `Quest completed: **${quest.name}**`);
      }
      continue;
    }

    const c = quest.conditions || {};
    if (!c.count || c.count <= 0) {
      console.log('[QUEST DEBUG] Invalid count', c.count);
      continue;
    }

    if (type === 'summon' || type === 'enchant') {
      if (!matchesCardFilters(c, payload.card)) continue;
    }

    if (type === 'route') {
      if (c.minWirlies != null) {
        const earned = payload.rewards?.wirlies || 0;
        if (earned < c.minWirlies) continue;
      }
    }

    if (type === 'command') {
      if (c.commandName && payload.commandName !== c.commandName) continue;
    }

    const uq = await UserQuest.findOneAndUpdate(
      { userId, questKey: quest.key },
      { $setOnInsert: { progress: 0, completed: false } },
      { upsert: true, new: true }
    );

    if (uq.completed) {
      console.log('[QUEST DEBUG] Already completed');
      continue;
    }

    console.log('[QUEST DEBUG] Incrementing quest', quest.key, 'from', uq.progress);
    uq.progress += 1;
    uq.updatedAt = new Date();

    if (uq.progress >= c.count) {
      uq.completed = true;
      await uq.save();
      await completeQuest(userId, quest);
      await notify(interactionForNotify, `Quest completed: **${quest.name}**`);
      console.log('[QUEST DEBUG] Quest completed');
    } else {
      await uq.save();
      console.log('[QUEST DEBUG] Progress saved', uq.progress);
    }
  }
}

module.exports = { emitQuestEvent };
