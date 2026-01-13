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

    const results = [];

    for (const { cardCode, qty } of cards) {
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

      await CardInventory.updateOne(
        { userId: to, cardCode },
        { $setOnInsert: { userId: to, cardCode }, $inc: { quantity: qty } },
        { upsert: true }
      );

      const updated = await CardInventory.findOne({ userId: to, cardCode });
      results.push({ cardCode, qty, total: updated?.quantity ?? qty });
    }

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

    return {
      ok: true,
      ...(results.length > 0 ? { cards: results } : {}),
      ...(wirlies > 0 ? { wirlies } : {}),
      ...(keys > 0 ? { keys } : {})
    };
  },
};