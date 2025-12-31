const User = require('../models/User');

const MAX_KEYS = 200;

async function giveCurrency(userId, { wirlies = 0, keys = 0 }) {
  if (typeof wirlies !== 'number' || typeof keys !== 'number') {
    throw new TypeError('giveCurrency expects numeric wirlies and keys');
  }

  // Fetch current values first (needed for key cap)
  const user = await User.findOneAndUpdate(
    { userId },
    { $inc: { wirlies } },
    { new: true, upsert: true }
  );

  // Handle key cap
  if (keys > 0) {
    const keysToAdd = Math.max(
      0,
      Math.min(keys, MAX_KEYS - (user.keys ?? 0))
    );

    if (keysToAdd > 0) {
      return await User.findOneAndUpdate(
        { userId },
        { $inc: { keys: keysToAdd } },
        { new: true }
      );
    }
  }

  return user;
}

module.exports = {
  giveCurrency,
  MAX_KEYS,
};
