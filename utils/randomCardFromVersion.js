const { getGlobalPullConfig } = require('./globalPullConfig');
const { weightedPick } = require('./weightedPick');
const Card = require('../models/Card');
const User = require('../models/User');
const Batch = require('../models/Batch');

async function getRandomCardFromVersion(version, userId) {
  const user = await User.findOne({ userId });
const blockedGroups = (user?.blockedPulls?.groups || []).map(v => String(v).toLowerCase());
const blockedNames = (user?.blockedPulls?.names || []).map(v => String(v).toLowerCase());
const blockedPairs = user?.blockedPulls?.pairs || [];

  // ✅ Step 1: Unbatch cards from released batches
  const now = new Date();

// Auto-activate cards from released batches
const releasedBatches = await Batch.find({
  releaseAt: { $lte: now }
}).lean();

const releasedCodes = releasedBatches.map(b => b.code);

if (releasedCodes.length > 0) {
  await Card.updateMany(
    {
      batch: { $in: releasedCodes },
    },
    {
      $set: {
        active: true,
        batch: null,
      },
    }
  );
}

// Auto-deactivate cards by time
await Card.updateMany(
  { deactivateAt: { $lte: now }, active: true },
  { $set: { active: false } }
);


  // ✅ Step 2: Prepare user preferences
const alwaysInclude = ['specials'];
const prefs = user?.enabledCategories ?? [];
const categories = prefs.length
  ? [...new Set([...prefs, ...alwaysInclude])]
  : undefined;

// ✅ Step 3: Pull cards with filters
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

  // ✅ Step 4: Apply weighted logic
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
  return await Card.findById(picked._id); // hydrate
}

module.exports = getRandomCardFromVersion;