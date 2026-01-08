const UserQuest = require('../../models/UserQuest');
const { giveCurrency } = require('../giveCurrency');

async function completeQuest(userId, quest) {
  await UserQuest.updateOne(
    { userId, questKey: quest.key },
    {
      completed: true,
      completedAt: new Date(),
      updatedAt: new Date(),
    },
    { upsert: true }
  );

  await giveCurrency(userId, {
    wirlies: quest.rewards.wirlies || 0,
    keys: quest.rewards.keys || 0,
  });
}

module.exports = { completeQuest };
