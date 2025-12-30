// utils/globalPullConfig.js

// Hardcoded rarity weights
const VERSION_WEIGHTS = {
  'V1': 35.7,
  'V2': 29,
  'V3': 21,
  'V4': 13,
  'V5': 1.3,
};

// Hardcoded multipliers for eras (always lowercased keys!)
const ERA_MULTIPLIERS = {
};

// Hardcoded multipliers for specific card codes (always lowercased keys!)
const CODE_MULTIPLIERS = {
};

const MIN_WEIGHT = 0.00001;
const MAX_WEIGHT = 10000;

function getGlobalPullConfig() {
  return {
    versionWeights: VERSION_WEIGHTS,
    eraMultipliers: ERA_MULTIPLIERS,
    codeMultipliers: CODE_MULTIPLIERS,
    minWeight: MIN_WEIGHT,
    maxWeight: MAX_WEIGHT,
  };
}

module.exports = { getGlobalPullConfig };