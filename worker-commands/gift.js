const CardInventory = require('../models/CardInventory');
const User = require('../models/User');

module.exports = async function giftWorker(job) {
  const { from, to, cards, wirlies } = job.data;

  /* ===========================
     Gift cards
  =========================== */
  for (const { cardCode, qty } of cards) {
    if (!cardCode || qty <= 0) {
      throw new Error('Invalid card payload.');
    }

    const dec = await CardInventory.findOneAndUpdate(
      { userId: from, cardCode, quantity: { $gte: qty } },
      { $inc: { quantity: -qty } },
      { new: true }
    );

    if (!dec) {
      throw new Error(`Not enough copies of ${cardCode}`);
    }

    if (dec.quantity <= 0) {
      await CardInventory.deleteOne({ userId: from, cardCode });
    }

    await CardInventory.updateOne(
      { userId: to, cardCode },
      {
        $setOnInsert: { userId: to, cardCode },
        $inc: { quantity: qty },
      },
      { upsert: true }
    );
  }

  /* ===========================
     Gift Wirlies
  =========================== */
  if (wirlies && wirlies > 0) {
    const sender = await User.findOneAndUpdate(
      { userId: from, wirlies: { $gte: wirlies } },
      { $inc: { wirlies: -wirlies } },
      { new: true }
    );

    if (!sender) {
      throw new Error('Not enough Wirlies.');
    }

    await User.updateOne(
      { userId: to },
      { $inc: { wirlies } },
      { upsert: true }
    );
  }

  return { ok: true };
};