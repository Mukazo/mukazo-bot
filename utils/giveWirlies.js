const User = require('../models/User');

async function giveWirlies(userId, amount) {
  return await User.findOneAndUpdate(
    { userId },
    { $inc: { wirlies: amount } },
    { new: true, upsert: true }
  );
}

module.exports = giveWirlies;
