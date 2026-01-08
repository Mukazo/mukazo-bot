const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

async function isCompletionMet(userId, quest) {
  const q = quest.conditions || {};

  const required = await Card.find({
    active: true,
    batch: null,
    ...(q.version != null ? { version: q.version } : {}),
    ...(q.group != null ? { group: q.group } : {}),
    ...(q.era != null ? { era: q.era } : {}),
  }).select('cardCode').lean();

  if (!required.length) return false;

  const codes = required.map(c => c.cardCode);

  const owned = await CardInventory.find({
    userId,
    cardCode: { $in: codes },
    quantity: { $gt: 0 },
  }).select('cardCode').lean();

  return owned.length === codes.length;
}

module.exports = { isCompletionMet };
