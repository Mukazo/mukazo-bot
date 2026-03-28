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
      if (!Number.isInteger(qty) || qty === 0) {
        throw new Error(`Invalid quantity for ${cardCode}`);
      }

      if (!auth) {
        if (qty < 0) {
          throw new Error(`Negative card quantities are only allowed for authorized gifts.`);
        }

        const dec = await CardInventory.findOneAndUpdate(
          { userId: from, cardCode, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          { new: true }
        );

        if (!dec) throw new Error(`Not enough copies of ${cardCode}`);
        if (dec.quantity <= 0) {
          await CardInventory.deleteOne({ userId: from, cardCode });
        }

        await CardInventory.updateOne(
          { userId: to, cardCode },
          { $setOnInsert: { userId: to, cardCode }, $inc: { quantity: qty } },
          { upsert: true }
        );

      } else {
        if (qty > 0) {
          await CardInventory.updateOne(
            { userId: to, cardCode },
            { $setOnInsert: { userId: to, cardCode }, $inc: { quantity: qty } },
            { upsert: true }
          );
        } else {
          const absQty = Math.abs(qty);

          const dec = await CardInventory.findOneAndUpdate(
            { userId: to, cardCode, quantity: { $gte: absQty } },
            { $inc: { quantity: -absQty } },
            { new: true }
          );

          if (!dec) throw new Error(`Target user does not have enough copies of ${cardCode} to remove.`);
          if (dec.quantity <= 0) {
            await CardInventory.deleteOne({ userId: to, cardCode });
          }
        }
      }

      const updated = await CardInventory.findOne({ userId: to, cardCode });
      results.push({ cardCode, qty, total: updated?.quantity ?? 0 });
    }

    if (wirlies !== 0) {
      if (!auth) {
        if (wirlies < 0) {
          throw new Error('Negative Wirlies are only allowed for authorized gifts.');
        }

        const sender = await User.findOneAndUpdate(
          { userId: from, wirlies: { $gte: wirlies } },
          { $inc: { wirlies: -wirlies } },
          { new: true }
        );
        if (!sender) throw new Error('Not enough Wirlies.');
        await User.updateOne(
          { userId: to },
          { $inc: { wirlies }, $setOnInsert: { userId: to } },
          { upsert: true }
        );
      } else {
        if (wirlies > 0) {
          await User.updateOne(
            { userId: to },
            { $inc: { wirlies }, $setOnInsert: { userId: to } },
            { upsert: true }
          );
        } else {
          const absW = Math.abs(wirlies);
          const updated = await User.findOneAndUpdate(
            { userId: to, wirlies: { $gte: absW } },
            { $inc: { wirlies: -absW } },
            { new: true }
          );
          if (!updated) throw new Error('Target user does not have enough Wirlies to remove.');
        }
      }
    }

    if (keys !== 0) {
      if (!auth) {
        if (keys < 0) {
          throw new Error('Negative Keys are only allowed for authorized gifts.');
        }

        const sender = await User.findOneAndUpdate(
          { userId: from, keys: { $gte: keys } },
          { $inc: { keys: -keys } },
          { new: true }
        );
        if (!sender) throw new Error('Not enough Keys.');

        await User.updateOne(
          { userId: to },
          {
            $inc: { keys },
            $setOnInsert: { userId: to },
          },
          { upsert: true }
        );
      } else {
        if (keys > 0) {
          await User.updateOne(
            { userId: to },
            {
              $inc: { keys },
              $setOnInsert: { userId: to },
            },
            { upsert: true }
          );
        } else {
          const absK = Math.abs(keys);
          const updated = await User.findOneAndUpdate(
            { userId: to, keys: { $gte: absK } },
            { $inc: { keys: -absK } },
            { new: true }
          );
          if (!updated) throw new Error('Target user does not have enough Keys to remove.');
        }
      }
    }

    return {
      ok: true,
      ...(results.length > 0 ? { cards: results } : {}),
      ...(wirlies !== 0 ? { wirlies } : {}),
      ...(keys !== 0 ? { keys } : {})
    };
  },
};