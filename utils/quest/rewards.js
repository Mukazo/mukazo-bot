const User = require('../../models/User');
const UserQuest = require('../../models/UserQuest');

async function completeQuest(userId, quest) {
  // Mark reward claimed once (prevents double payouts)
  const uq = await UserQuest.findOne({ userId, questKey: quest.key });
  if (!uq) return { ok: false, reason: 'missing-userquest' };

  if (uq.rewardClaimed) return { ok: true, already: true };

  const wirlies = Number(quest.rewards?.wirlies || 0);
  const keys = Number(quest.rewards?.keys || 0);

  // Apply rewards
  const inc = {};
  if (wirlies) inc.wirlies = wirlies;
  if (keys) inc.keys = keys;

  if (Object.keys(inc).length) {
    await User.updateOne({ userId }, { $inc: inc }, { upsert: true });
  }

  uq.rewardClaimed = true;
  uq.rewardClaimedAt = new Date();
  await uq.save();

  return { ok: true, wirlies, keys };
}

module.exports = { completeQuest };
