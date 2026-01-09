const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

/**
 * Completion = "own all cards matching conditions".
 * Conditions supported now: era, group, version (any combination).
 */
async function checkCompletionProgress(userId, quest) {
  const c = quest.conditions || {};

  const cardQuery = {};
  if (c.era) cardQuery.era = c.era;
  if (c.group) cardQuery.group = c.group;
  if (typeof c.version === 'number') cardQuery.version = c.version;

  const required = await Card.find(cardQuery, { _id: 0, cardCode: 1 }).lean();
  const total = required.length;

  if (!total) return { owned: 0, total: 0, completed: false, percent: 0 };

  const requiredCodes = required.map(x => x.cardCode);

  // User owns any cardCode in required with quantity > 0
  const ownedCount = await CardInventory.countDocuments({
    userId,
    cardCode: { $in: requiredCodes },
    quantity: { $gt: 0 },
  });

  const completed = ownedCount >= total;
  const percent = total > 0 ? Math.floor((ownedCount / total) * 100) : 0;

  return { owned: ownedCount, total, completed, percent };
}

module.exports = { checkCompletionProgress };
