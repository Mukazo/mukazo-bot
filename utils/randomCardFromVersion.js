const { getGlobalPullConfig } = require('./globalPullConfig');
const { weightedPick } = require('./weightedPick');
const Card = require('../models/Card');
const User = require('../models/User');

async function getRandomCardFromVersion(version, userId) {
  const user = await User.findOne({ userId }).lean();
  const blockedGroups = (user?.blockedPulls?.groups || []).map(v => String(v).toLowerCase());
  const blockedNames = (user?.blockedPulls?.names || []).map(v => String(v).toLowerCase());
  const blockedPairs = user?.blockedPulls?.pairs || [];

  const alwaysInclude = ['specials'];
  const prefs = user?.enabledCategories ?? [];
  const categories = prefs.length
    ? [...new Set([...prefs, ...alwaysInclude])]
    : undefined;

  const filter = {
    version,
    active: true,
    $and: [
      {
        $or: [
          { releaseAt: null },
          { releaseAt: { $lte: new Date() } }
        ]
      },
      {
        $or: [
          { availableQuantity: null },
          { $expr: { $lt: ['$timesPulled', '$availableQuantity'] } }
        ]
      },
      ...(categories
        ? [
            {
              $or: [
                { category: { $in: categories } },
                { categoryalias: { $in: categories } }
              ]
            }
          ]
        : [
            {
              categoryalias: { $exists: false }
            }
          ]),
      ...(version >= 1 && version <= 4 && blockedGroups.length
        ? [{
            group: {
              $nin: blockedGroups.map(v => new RegExp(`^${v}$`, 'i'))
            }
          }]
        : []),
      ...(version >= 1 && version <= 4 && blockedNames.length
        ? [{
            $and: [
              {
                name: {
                  $nin: blockedNames.map(v => new RegExp(`^${v}$`, 'i'))
                }
              },
              {
                namealias: {
                  $nin: blockedNames.map(v => new RegExp(`^${v}$`, 'i'))
                }
              }
            ]
          }]
        : []),
      ...(version >= 1 && version <= 4 && blockedPairs.length
        ? [{
            $nor: blockedPairs.map(p => ({
              group: new RegExp(`^${p.group}$`, 'i'),
              $or: [
                { name: new RegExp(`^${p.name}$`, 'i') },
                { namealias: new RegExp(`^${p.name}$`, 'i') }
              ]
            }))
          }]
        : [])
    ]
  };

  const cards = await Card.find(filter).lean();
  if (!cards.length) return null;

  const cfg = getGlobalPullConfig();
  const { eraMultipliers, codeMultipliers, minWeight, maxWeight } = cfg;

  const weights = cards.map(c => {
    const eraKey = c.era ? String(c.era).toLowerCase() : '';
    const codeKey = c.cardCode ? String(c.cardCode).toLowerCase() : '';

    const mEra = eraKey && eraMultipliers[eraKey] !== undefined ? eraMultipliers[eraKey] : 1;
    const mCode = codeKey && codeMultipliers[codeKey] !== undefined ? codeMultipliers[codeKey] : 1;

    return Math.min(maxWeight, Math.max(minWeight, 1 * mEra * mCode));
  });

  const picked = weightedPick(cards, weights);
  if (!picked) return null;
  return picked;
}

module.exports = getRandomCardFromVersion;