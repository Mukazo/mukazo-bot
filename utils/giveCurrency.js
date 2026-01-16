const User = require('../models/User');

const MAX_KEYS = 5000;

async function giveCurrency(userId, { wirlies = 0, keys = 0 }) {
  if (typeof wirlies !== 'number' || typeof keys !== 'number') {
    throw new TypeError('giveCurrency expects numeric wirlies and keys');
  }

  // Fetch current balances
  const user =
    (await User.findOne({ userId }).lean()) ?? {
      wirlies: 0,
      keys: 0,
    };

  /* ===========================
     WIRLIES (allow negative, floor at 0)
  =========================== */
  let finalWirliesChange = wirlies;

  if (wirlies < 0) {
    finalWirliesChange = Math.max(wirlies, -user.wirlies);
  }

  /* ===========================
     KEYS (allow negative + cap)
  =========================== */
  let finalKeysChange = keys;

  if (keys > 0) {
    finalKeysChange = Math.min(keys, MAX_KEYS - user.keys);
  }

  if (keys < 0) {
    finalKeysChange = Math.max(keys, -user.keys);
  }

  return await User.findOneAndUpdate(
    { userId },
    {
      $inc: {
        wirlies: finalWirliesChange,
        keys: finalKeysChange,
      },
    },
    { new: true, upsert: true }
  );
}

module.exports = {
  giveCurrency,
  MAX_KEYS,
};