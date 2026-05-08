function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPullFilter(version, user) {
  const blockedGroups = (user?.blockedPulls?.groups || []).map(v => String(v).toLowerCase());
  const blockedNames = (user?.blockedPulls?.names || []).map(v => String(v).toLowerCase());
  const blockedPairs = user?.blockedPulls?.pairs || [];

  const alwaysInclude = ['specials'];
  const prefs = user?.enabledCategories ?? [];
  const categories = prefs.length
    ? [...new Set([...prefs, ...alwaysInclude])]
    : undefined;

  return {
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
  $and: [
    {
      group: {
        $nin: blockedGroups.map(v => new RegExp(`^${escapeRegex(v)}$`, 'i'))
      }
    },
    {
      groupalias: {
        $nin: blockedGroups.map(v => new RegExp(`^${escapeRegex(v)}$`, 'i'))
      }
    }
  ]
}]
        : []),
      ...(version >= 1 && version <= 4 && blockedNames.length
        ? [{
  $and: [
    {
      name: {
        $nin: blockedNames.map(v => new RegExp(`^${escapeRegex(v)}$`, 'i'))
      }
    },
    {
      namealias: {
        $nin: blockedNames.map(v => new RegExp(`^${escapeRegex(v)}$`, 'i'))
      }
    }
  ]
}]
        : []),
      ...(version >= 1 && version <= 4 && blockedPairs.length
        ? [{
            $nor: blockedPairs.map(p => {
  const safeGroup = escapeRegex(p.group);
  const safeName = escapeRegex(p.name);

  return {
    $or: [
      {
        group: new RegExp(`^${safeGroup}$`, 'i'),
        $or: [
          { name: new RegExp(`^${safeName}$`, 'i') },
          { namealias: new RegExp(`^${safeName}$`, 'i') }
        ]
      },
      {
        groupalias: new RegExp(`^${safeGroup}$`, 'i'),
        $or: [
          { name: new RegExp(`^${safeName}$`, 'i') },
          { namealias: new RegExp(`^${safeName}$`, 'i') }
        ]
      }
    ]
  };
})
          }]
        : [])
    ]
  };
}

module.exports = buildPullFilter;