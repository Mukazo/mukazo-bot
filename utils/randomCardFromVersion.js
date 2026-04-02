const { weightedPick } = require('./weightedPick');
const User = require('../models/User');
const { getPullPool } = require('./pullPoolCache');

async function getRandomCardFromVersion(version, userId, providedUser = null) {
  const user = providedUser ?? await User.findOne({ userId })
    .select('enabledCategories blockedPulls')
    .lean();

  const { cards, weights } = await getPullPool(version, user);

  if (!cards.length) return null;

  const picked = weightedPick(cards, weights);
  if (!picked) return null;

  return picked;
}

module.exports = getRandomCardFromVersion;