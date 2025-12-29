const { getGlobalPullConfig } = require('./globalPullConfig');

function pickVersion() {
  const cfg = getGlobalPullConfig();
  const entries = Object.entries(cfg.versionWeights);

  if (!entries.length) {
    throw new Error('No version weights configured');
  }

  const total = entries.reduce((sum, [, w]) => sum + Number(w || 0), 0);
  let roll = Math.random() * total;

  for (const [label, weight] of entries) {
    roll -= Number(weight || 0);
    if (roll <= 0) {
      // "V3" -> 3
      return Number(label.replace('V', ''));
    }
  }

  // Safety fallback
  return Number(entries[0][0].replace('V', ''));
}

module.exports = pickVersion;
