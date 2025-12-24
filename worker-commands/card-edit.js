// src/worker-commands/card-edit.js
const Card = require('../models/Card');
const CardInventory = require('../models/CardInventory');
const Batch = require('../models/Batch');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

// Replace image if requested
if (updates.imageUrl) {
  const image = await axios.get(updates.imageUrl, {
    responseType: 'arraybuffer',
  });

  const imageDir = path.join(__dirname, '..', 'images');

  for (const card of cards) {
    const imagePath = path.join(imageDir, `${card.cardCode}.png`);
    fs.writeFileSync(imagePath, image.data);

    await Card.updateOne(
      { _id: card._id },
      { $set: { localImagePath: imagePath } }
    );
  }

  delete updates.imageUrl;
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
