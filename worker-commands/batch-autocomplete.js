const Batch = require('../models/Batch');

module.exports = {
  async execute(data) {
    const jobId = data.jobId;
    const query = (data.query || '').trim();

    try {
      const filter = query
        ? {
            $or: [
              { code: { $regex: query, $options: 'i' } },
              { name: { $regex: query, $options: 'i' } },
            ],
          }
        : {};

      const batches = await Batch.find(filter)
        .sort({ code: 1 })
        .limit(24)
        .lean();

      return {
        ok: true,
        jobId,
        batches: batches.map(batch => ({
          name: batch.name ? `${batch.name} (${batch.code})` : batch.code,
          value: batch.code,
        })),
      };
    } catch (err) {
      console.error('[BATCH AUTOCOMPLETE ERROR]', err);

      return {
        ok: false,
        jobId,
        batches: [],
        error: err.message,
      };
    }
  },
};