// src/worker-commands/card-create.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Card = require('../models/Card');
const Batch = require('../models/Batch');

module.exports = {
  async execute(data) {
    try {
      const image = await axios.get(data.imageUrl, {
        responseType: 'arraybuffer'
      });

      const imageDir = path.join(__dirname, '..', 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      const imagePath = path.join(imageDir, `${data.cardCode}.png`);
      fs.writeFileSync(imagePath, image.data);

      await Card.create({
        cardCode: data.cardCode,
        name: data.name,
        category: data.category,
        version: data.version,
        emoji: data.emoji,
        group: data.group,
        era: data.era,
        active: data.active,
        availableQuantity: data.availableQuantity,
        designerIds: data.designerIds,
        localImagePath: imagePath
      });

      const batches = await Batch.find().lean();

      return {
        ok: true,
        cardCode: data.cardCode,
        batches: batches.map(b => ({
          label: b.name,
          value: b.code
        }))
      };
    } catch (err) {
      return {
        ok: false,
        cardCode: data.cardCode,
        error: err.message
      };
    }
  }
};
