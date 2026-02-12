// src/worker-commands/card-create.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Card = require('../models/Card');
const Batch = require('../models/Batch');

module.exports = {
  async execute(data) {
    const jobId = data.jobId; // ✅ capture early

    try {
      // Validate required fields early (gives cleaner errors)
      if (!data.cardCode) throw new Error('Missing cardCode');
      if (!data.name) throw new Error('Missing name');
      if (!data.imageUrl) throw new Error('Missing imageUrl');

      const image = await axios.get(data.imageUrl, { responseType: 'arraybuffer' });

      const imageDir = path.join(__dirname, '..', 'images');
      if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

      const imagePath = path.join(imageDir, `${data.cardCode}.png`);
      fs.writeFileSync(imagePath, image.data);

      await Card.create({
        cardCode: data.cardCode,
        name: data.name,
        namealias: data.namealias,
        category: data.category,
        categoryalias: data.categoryalias,
        version: data.version,
        emoji: data.emoji,
        group: data.group,
        era: data.era,
        active: data.active,
        availableQuantity: data.availableQuantity,
        designerIds: data.designerIds,
        localImagePath: imagePath,
        createdBy: data.userId,
      });

      const batches = await Batch.find().lean();

      return {
        ok: true,
        jobId, // ✅ correct key
        cardCode: data.cardCode,
        batches: batches.map(b => ({
          label: b.name,
          value: b.code
        }))
      };
    } catch (err) {
      return {
        ok: false,
        jobId, // ✅ include so UI can match failures too
        cardCode: data.cardCode,
        error: err.message
      };
    }
  }
};
