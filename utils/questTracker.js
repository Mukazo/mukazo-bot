// utils/questTracker.js
const Quest = require('../models/Quest');
const UserQuest = require('../models/UserQuest');
const { giveCurrency } = require('./giveCurrency');
const CardInventory = require('../models/CardInventory');

async function emitQuestEvent(userId, event) {
  /*
    event = {
      type: 'summon',
      card: { version, group, era, cardCode }
    }
  */

  const quests = await Quest.find({ type: event.type }).lean();

  for (const quest of quests) {
    if (!matchesConditions(quest.conditions, event.card)) continue;

    const uq = await UserQuest.findOneAndUpdate(
      {
        userId,
        questKey: quest.key,
        completed: false,
      },
      {
        $inc: { progress: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    if (uq.progress >= quest.conditions.count) {
      await completeQuest(userId, quest, uq);
    }
  }
}

function matchesConditions(conditions, card) {
  if (conditions.version && conditions.version !== card.version) return false;
  if (conditions.group && conditions.group !== card.group) return false;
  if (conditions.era && conditions.era !== card.era) return false;
  return true;
}

async function completeQuest(userId, quest, uq) {
  uq.completed = true;
  await uq.save();

  if (quest.rewards.wirlies || quest.rewards.keys) {
    await giveCurrency(userId, quest.rewards);
  }

  if (quest.rewards.cards?.length) {
    for (const reward of quest.rewards.cards) {
      await CardInventory.updateOne(
        { userId, cardCode: reward.cardCode },
        { $inc: { quantity: reward.qty } },
        { upsert: true }
      );
    }
  }

  // Optional: emit notification / DM / log
}

module.exports = { emitQuestEvent };