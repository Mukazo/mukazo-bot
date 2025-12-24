// src/worker-commands/card-edit.js
const Card = require('../models/Card');
const CardInventory = require('../models/CardInventory');
const Batch = require('../models/Batch');

module.exports = {
  async execute({ jobId, filters, updates }) {
    try {
      // Fetch affected cards first
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
        modifiedCount: res.modifiedCount
      };
    } catch (err) {
      return {
        ok: false,
        jobId,
        error: err.message
      };
    }
  }
};
