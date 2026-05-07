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
                  $nin: blockedGroups.map(v => new RegExp(`^${v}$`, 'i'))
                }
              },
              {
                groupalias: {
                  $nin: blockedGroups.map(v => new RegExp(`^${v}$`, 'i'))
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
}

module.exports = buildPullFilter;