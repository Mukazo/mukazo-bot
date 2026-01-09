const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

/**
 * Completion check for state-based quests (era, group, version, etc.)
 * This scans the USER INVENTORY and joins back to Card.
 */
async function isCompletionMet(userId, quest) {
  const c = quest.conditions || {};

  // 1️⃣ Get all inventory card codes the user owns
  const inventory = await CardInventory.find(
    { userId, quantity: { $gt: 0 } },
    { cardCode: 1 }
  ).lean();

  if (!inventory.length) {
    return { owned: 0, total: 0, completed: false };
  }

  const ownedCodes = inventory.map(i => i.cardCode);

  // 2️⃣ Load the card documents for those inventory items
  const ownedCards = await Card.find(
    { cardCode: { $in: ownedCodes } },
    { cardCode: 1, era: 1, group: 1, version: 1 }
  ).lean();

  // 3️⃣ Determine the FULL REQUIRED SET (what exists in DB)
  const requiredCards = await Card.find(
    {
      ...(c.era != null ? { era: c.era } : {}),
      ...(c.group != null ? { group: c.group } : {}),
      ...(c.version != null ? { version: c.version } : {}),
    },
    { cardCode: 1 }
  ).lean();

  const total = requiredCards.length;
  if (!total) {
    return { owned: 0, total: 0, completed: false };
  }

  const requiredSet = new Set(requiredCards.map(c => c.cardCode));
  const ownedSet = new Set(ownedCards.map(c => c.cardCode));

  let owned = 0;
  for (const code of requiredSet) {
    if (ownedSet.has(code)) owned++;
  }

  return {
    owned,
    total,
    completed: owned === total,
  };
}

module.exports = { isCompletionMet };