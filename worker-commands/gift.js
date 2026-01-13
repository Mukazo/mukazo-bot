// worker-commands/gift.js
const CardInventory = require('../models/CardInventory');
const User = require('../models/User');

module.exports = {
  async execute(data) {
    const {
      from,
      to,
      cards = [],
      wirlies = 0,
      keys = 0,
      auth = false,
    } = data;

    /* ===========================
       CARD TRANSFER
    =========================== */
    for (const { cardCode, qty } of cards) {
      // ❌ AUTHGIFT: skip sender deduction
      if (!auth) {
        const dec = await CardInventory.findOneAndUpdate(
          { userId: from, cardCode, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          { new: true }
        );

        if (!dec) throw new Error(`Not enough copies of ${cardCode}`);

        if (dec.quantity <= 0) {
          await CardInventory.deleteOne({ userId: from, cardCode });
        }
      }

      // ✅ Always add to recipient
      await CardInventory.updateOne(
        { userId: to, cardCode },
        { $setOnInsert: { userId: to, cardCode }, $inc: { quantity: qty } },
        { upsert: true }
      );
    }

    /* ===========================
       WIRLIES
    =========================== */
    if (wirlies > 0) {
      if (!auth) {
        const sender = await User.findOneAndUpdate(
          { userId: from, wirlies: { $gte: wirlies } },
          { $inc: { wirlies: -wirlies } },
          { new: true }
        );

        if (!sender) throw new Error('Not enough Wirlies.');
      }

      await User.updateOne(
        { userId: to },
        { $inc: { wirlies } },
        { upsert: true }
      );
    }

    /* ===========================
       KEYS
    =========================== */
    if (keys > 0) {
      if (!auth) {
        const sender = await User.findOneAndUpdate(
          { userId: from, keys: { $gte: keys } },
          { $inc: { keys: -keys } },
          { new: true }
        );

        if (!sender) throw new Error('Not enough Keys.');
      }

      await User.updateOne(
        { userId: to },
        {
          $inc: { keys },
          $setOnInsert: { userId: to },
        },
        { upsert: true }
      );
    }

    return { ok: true };
  },
};