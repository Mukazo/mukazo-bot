const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

async function checkCompletion(userId, quest) {
  const c = quest.conditions || {};

  // Fetch all required cards (NO active/batch filters)
  const requiredCards = await Card.find(
    {
      ...(c.version != null ? { version: c.version } : {}),
      ...(c.group != null ? { group: c.group } : {}),
      ...(c.era != null ? { era: c.era } : {}),
    },
    { _id: 0, cardCode: 1 }
  ).lean();

  if (!requiredCards.length) {
    return { owned: 0, total: 0, completed: false };
  }

  const requiredCodes = requiredCards.map(c => String(c.cardCode).toUpperCase());

  // Count how many the user owns (quantity > 0)
  const ownedCount = await CardInventory.countDocuments({
    userId,
    cardCode: { $in: requiredCodes },
    quantity: { $gt: 0 },
  });

  return {
    owned: ownedCount,
    total: requiredCodes.length,
    completed: ownedCount === requiredCodes.length,
  };
}

module.exports = {
  checkCompletion,
};
