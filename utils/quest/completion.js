const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

async function isCompletionMet(userId, quest) {
  const q = quest.conditions || {};

  // 1️⃣ Get all required card codes (NO active/batch filters)
  const required = await Card.find(
    {
      ...(q.version != null ? { version: q.version } : {}),
      ...(q.group != null ? { group: q.group } : {}),
      ...(q.era != null ? { era: q.era } : {}),
    },
    { _id: 0, cardCode: 1 }
  ).lean();

  if (!required.length) return false;

  const requiredSet = new Set(
    required.map(c => String(c.cardCode).toUpperCase())
  );

  // 2️⃣ Fetch owned codes with quantity > 0
  const ownedCodes = await CardInventory.distinct('cardCode', {
    userId,
    cardCode: { $in: [...requiredSet] },
    quantity: { $gt: 0 },
  });

  const ownedSet = new Set(
    ownedCodes.map(c => String(c).toUpperCase())
  );

  // 3️⃣ Ensure every required card is owned
  for (const code of requiredSet) {
    if (!ownedSet.has(code)) return false;
  }

  return true;
}

module.exports = { isCompletionMet };