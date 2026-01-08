const UserQuest = require('../../models/UserQuest');
const { giveCurrency } = require('../giveCurrency'); // your combined wirlies/keys util

async function completeQuest(userId, quest) {
  await UserQuest.updateOne(
    { userId, questKey: quest.key },
    {
      $set: {
        completed: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  const wirlies = quest.rewards?.wirlies || 0;
  const keys = quest.rewards?.keys || 0;

  if (wirlies !== 0 || keys !== 0) {
    await giveCurrency(userId, { wirlies, keys });
  }
}

module.exports = { completeQuest };
