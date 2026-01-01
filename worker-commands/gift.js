const CardInventory = require('../models/CardInventory');

module.exports = async function giftWorker(job) {
  const { from, to, cards } = job.data;

  if (!Array.isArray(cards) || !cards.length) {
    throw new Error('No cards to gift.');
  }

  for (const { cardCode, qty } of cards) {
    if (!cardCode || !Number.isFinite(qty) || qty <= 0) {
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

  return { ok: true };
};
