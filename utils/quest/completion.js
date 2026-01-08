const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

async function isCompletionMet(userId, quest) {
  const cards = await Card.find({
    active: true,
    batch: null,
    ...(quest.conditions.version != null && { version: quest.conditions.version }),
    ...(quest.conditions.group != null && { group: quest.conditions.group }),
    ...(quest.conditions.era != null && { era: quest.conditions.era }),
  }).select('cardCode').lean();

  if (!cards.length) return false;

  const owned = await CardInventory.find({
    userId,
    cardCode: { $in: cards.map(c => c.cardCode) },
    quantity: { $gt: 0 },
  }).lean();

  return owned.length === cards.length;
}

module.exports = { isCompletionMet };
