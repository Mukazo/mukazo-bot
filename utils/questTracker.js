// utils/questTracker.js
const Quest = require('../models/Quest');
const UserQuest = require('../models/UserQuest');
const { giveCurrency } = require('./giveCurrency');
const CardInventory = require('../models/CardInventory');

async function emitQuestEvent(userId, event, interaction) {
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
        category: quest.category,
        completed: false,
      },
      {
        $inc: { progress: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    if (uq.progress >= quest.conditions.count) {
      await completeQuest(userId, quest, uq, interaction);
    }
  }
}

function matchesConditions(conditions, card) {
  if (conditions.version && conditions.version !== card.version) return false;
  if (conditions.group && conditions.group !== card.group) return false;
  if (conditions.era && conditions.era !== card.era) return false;
  return true;
}

const dmFailedCache = new Set();

async function completeQuest(userId, quest, uq, interaction) {
  uq.completed = true;
  await uq.save();

  let wirlies = 0;
  let keys = 0;

  // 💰 Currency rewards
  if (quest.rewards.wirlies || quest.rewards.keys) {
    const result = await giveCurrency(userId, quest.rewards);
    wirlies = quest.rewards.wirlies || 0;
    keys = quest.rewards.keys || 0;
  }

  // 🃏 Card rewards
  if (quest.rewards.cards?.length) {
    for (const reward of quest.rewards.cards) {
      await CardInventory.updateOne(
        { userId, cardCode: reward.cardCode },
        { $inc: { quantity: reward.qty } },
        { upsert: true }
      );
    }
  }

  // 🚨 MESSAGE SYSTEM
  const parts = [];
  if (wirlies) parts.push(`<:Wirlies:1455924065972785375> ${wirlies}`);
  if (keys) parts.push(`<:Key:1456059698582392852> ${keys}`);
  if (quest.rewards.cards?.length) {
    parts.push(`${quest.rewards.cards.length} Card(s)`);
  }

  const msg = [
    `ʚ <@${userId}> completed a quest ɞ`,
    `> ⊹ **${quest.name}**`,
    `> ${parts.join(' • ') || 'Rewards'}`
  ].join('\n');

  // 🔹 Try DM first
  if (!dmFailedCache.has(userId)) {
    try {
      const user = await interaction.client.users.fetch(userId);
      await user.send({ content: msg });
      return;
    } catch {
      dmFailedCache.add(userId);
    }
  }

  // 🔹 Fallback to channel
  if (interaction?.channel) {
    await interaction.channel.send({ content: msg }).catch(() => {});
  }
}

module.exports = { emitQuestEvent };