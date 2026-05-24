const Card = require('./models/Card');
const CardInventory = require('./models/CardInventory');
const CardLeaderboard = require('./models/CardLeaderboard');

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeRegex(value) {
  return new RegExp(`^${escapeRegExp(value)}$`, 'i');
}

function makeScopeKey({ group, name, era }) {
  return [
    group ? `group:${group.toLowerCase()}` : 'group:*',
    name ? `name:${name.toLowerCase()}` : 'name:*',
    era ? `era:${era.toLowerCase()}` : 'era:*',
  ].join('|');
}

async function updateCardLeaderboard({ group = null, name = null, era = null } = {}) {
  const and = [];

  if (group) {
    const regex = makeRegex(group);
    and.push({
      $or: [
        { group: regex },
        { groupalias: regex },
      ],
    });
  }

  if (name) {
    const regex = makeRegex(name);
    and.push({
      $or: [
        { name: regex },
        { namealias: regex },
      ],
    });
  }

  if (era) {
    and.push({ era: makeRegex(era) });
  }

  const cardQuery = and.length ? { $and: and } : {};
  const scopeKey = makeScopeKey({ group, name, era });

  const cards = await Card.find(cardQuery)
    .select('cardCode version')
    .lean();

  const versionByCode = new Map(
    cards.map(card => [card.cardCode, Number(card.version) || 1])
  );

  const cardCodes = [...versionByCode.keys()];

  if (!cardCodes.length) {
    await CardLeaderboard.deleteOne({ scopeKey });
    return;
  }

  const inventory = await CardInventory.find({
    cardCode: { $in: cardCodes },
    quantity: { $gt: 0 },
  })
    .select('userId cardCode quantity')
    .lean();

  const copyScores = new Map();

  for (const item of inventory) {
    const version = versionByCode.get(item.cardCode) || 1;
    const quantity = Number(item.quantity) || 0;

    copyScores.set(
      item.userId,
      (copyScores.get(item.userId) || 0) + quantity * version
    );
  }

  const rows = [...copyScores.entries()]
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  await CardLeaderboard.updateOne(
    { scopeKey },
    {
      $set: {
        scopeKey,
        filters: { group, name, era },
        rows,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log(`[Leaderboard] Updated ${scopeKey} with ${rows.length} rows`);
}

module.exports = {
  updateCardLeaderboard,
  makeScopeKey,
};