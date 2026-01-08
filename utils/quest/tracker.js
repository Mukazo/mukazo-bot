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
  const uq = await UserQuest.findOne({ userId, questKey: prerequisiteKey, completed: true }).lean();
  return Boolean(uq);
}

function matchesCardFilters(conditions, card) {
  if (!card) return false;
  if (conditions.version != null && card.version !== conditions.version) return false;
  if (conditions.group != null && card.group !== conditions.group) return false;
  if (conditions.era != null && card.era !== conditions.era) return false;
  return true;
}

async function notify(interaction, text) {
  if (!interaction?.followUp) return;
  try {
    await interaction.followUp({ content: text, ephemeral: true });
  } catch {}
}

/**
 * payload shapes:
 * - summon/enchant: { type:'summon', card:{version,group,era,cardCode} }
 * - route:          { type:'route', rewards:{wirlies,keys}, routeName? }
 * - command usage:  { type:'command', commandName:'inventory' }
 */
async function emitQuestEvent(userId, payload, interactionForNotify = null) {
  // ensure daily/weekly exist for this cycle
  await ensureAssigned(userId, 'daily', 3);
  await ensureAssigned(userId, 'weekly', 3);

  const quests = await Quest.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).lean();

  for (const quest of quests) {
    if (isExpired(quest)) continue;
    if (!(await prerequisiteMet(userId, quest.prerequisiteKey))) continue;

    // Filter by trigger
    const trigger = quest.trigger;
    const type = payload.type;

    if (trigger !== 'any' && trigger !== type) continue;

    // COMPLETION QUESTS (own all)
    if (quest.mode === 'completion') {
      const uq = await UserQuest.findOne({ userId, questKey: quest.key }).lean();
      if (uq?.completed) continue;

      const met = await isCompletionMet(userId, quest);
      if (met) {
        await completeQuest(userId, quest);
        await notify(interactionForNotify, `✅ Quest completed: **${quest.name}**`);
      }
      continue;
    }

    // PROGRESS QUESTS
    const c = quest.conditions || {};
    if (!c.count || c.count <= 0) continue; // must have count for progress quests

    // summon/enchant card filter quests
    if (type === 'summon' || type === 'enchant') {
      if (!matchesCardFilters(c, payload.card)) continue;
      // passes filters -> +1 progress
    }

    // route earn quests
    if (type === 'route') {
      if (c.minWirlies != null) {
        const earned = payload.rewards?.wirlies || 0;
        if (earned < c.minWirlies) continue;
      }
      // passes -> +1 progress (or you could add earned amount, but keeping it consistent)
    }

    // command usage quests
    if (type === 'command') {
      if (c.commandName && payload.commandName !== c.commandName) continue;
      // passes -> +1 progress
    }

    const uq = await UserQuest.findOneAndUpdate(
  { userId, questKey: quest.key },
  {
    $setOnInsert: {
      progress: 0,
      completed: false,
    },
  },
  { upsert: true, new: true }
);

if (uq.completed) continue;

    uq.progress += 1;
uq.updatedAt = new Date();

if (uq.progress >= c.count) {
  uq.completed = true;
  await uq.save();
  await completeQuest(userId, quest);
  await notify(interactionForNotify, `Quest completed: **${quest.name}**`);
} else {
  await uq.save();
}
  }
}

module.exports = { emitQuestEvent };
