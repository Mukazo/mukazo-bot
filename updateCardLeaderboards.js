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
  const cardQuery = {};

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

  if (and.length) cardQuery.$and = and;

  const cards = await Card.find(cardQuery)
    .select('cardCode version')
    .lean();

  const versionByCode = new Map(
    cards.map(card => [card.cardCode, Number(card.version) || 1])
  );

  const cardCodes = [...versionByCode.keys()];
  const scopeKey = makeScopeKey({ group, name, era });

  if (!cardCodes.length) {
    await CardLeaderboard.deleteMany({ scopeKey });
    return;
  }

  const inventory = await CardInventory.find({
    cardCode: { $in: cardCodes },
    quantity: { $gt: 0 },
  })
    .select('userId cardCode quantity')
    .lean();

  const distinctScores = new Map();
  const copyScores = new Map();

  for (const item of inventory) {
    const version = versionByCode.get(item.cardCode) || 1;
    const quantity = Number(item.quantity) || 0;

    distinctScores.set(
      item.userId,
      (distinctScores.get(item.userId) || 0) + 1
    );

    copyScores.set(
      item.userId,
      (copyScores.get(item.userId) || 0) + quantity * version
    );
  }

  const now = new Date();

  const docs = [];

  for (const [userId, score] of distinctScores.entries()) {
    docs.push({
      scopeKey,
      type: 'distinct',
      userId,
      score,
      filters: { group, name, era },
      updatedAt: now,
    });
  }

  for (const [userId, score] of copyScores.entries()) {
    docs.push({
      scopeKey,
      type: 'copies',
      userId,
      score,
      filters: { group, name, era },
      updatedAt: now,
    });
  }

  await CardLeaderboard.deleteMany({ scopeKey });

  if (docs.length) {
    await CardLeaderboard.insertMany(docs, { ordered: false });
  }
}

module.exports = {
  updateCardLeaderboard,
  makeScopeKey,
};