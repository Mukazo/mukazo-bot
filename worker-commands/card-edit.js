// src/worker-commands/card-edit.js
const Card = require('../models/Card');
const CardInventory = require('../models/CardInventory');
const Batch = require('../models/Batch');

/* ===========================
   REGEX REVIVAL (CRITICAL)
=========================== */
function reviveRegex(value) {
  if (typeof value === 'string') {
    return new RegExp(value, 'i');
  }

  if (value?.$in) {
    return { $in: value.$in.map(v => new RegExp(v, 'i')) };
  }

  return value;
}

module.exports = {
  async execute({ jobId, filters, updates }) {
    try {
      // Revive ALL possible regex filters
      if (filters.cardCode) filters.cardCode = reviveRegex(filters.cardCode);
      if (filters.name) filters.name = reviveRegex(filters.name);
      if (filters.group) filters.group = reviveRegex(filters.group);

      // Fetch affected cards
      const cards = await Card.find(filters).lean();
      if (!cards.length) {
        return { ok: true, jobId, modifiedCount: 0 };
      }

      const oldCodes = cards.map(c => c.cardCode);

      // Batch logic
      if (updates.batch) {
        const batch = await Batch.findOne({ code: updates.batch }).lean();
        if (batch?.deactivateCardsAt && !updates.deactivateAt) {
          updates.deactivateAt = batch.deactivateCardsAt;
        }
      }

      // Apply updates
      const res = await Card.updateMany(filters, { $set: updates });

      // Update inventories if cardCode changed
      if (updates.cardCode) {
        await CardInventory.updateMany(
          { cardCode: { $in: oldCodes } },
          { $set: { cardCode: updates.cardCode } }
        );
      }

      return {
        ok: true,
        jobId,
        modifiedCount: res.modifiedCount,
      };
    } catch (err) {
      console.error('[WORKER card-edit]', err);

      return {
        ok: false,
        jobId,
        error: err.message,
      };
    }
  },
};
