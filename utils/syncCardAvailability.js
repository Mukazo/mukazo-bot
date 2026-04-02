const Card = require('../models/Card');
const Batch = require('../models/Batch');

async function syncCardAvailability() {
  const now = new Date();

  // Activate cards from released batches
  const releasedBatches = await Batch.find({
    releaseAt: { $lte: now }
  }).lean();

  const releasedCodes = releasedBatches.map(b => b.code);

  if (releasedCodes.length > 0) {
    await Card.updateMany(
      {
        batch: { $in: releasedCodes },
      },
      {
        $set: {
          active: true,
          batch: null,
        },
      }
    );
  }

  // Deactivate cards whose deactivateAt has passed
  await Card.updateMany(
    { deactivateAt: { $lte: now }, active: true },
    { $set: { active: false } }
  );
}

module.exports = syncCardAvailability;