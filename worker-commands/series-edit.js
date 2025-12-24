// src/worker-commands/series-edit.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Series = require('../models/Series');

module.exports = {
  async execute({ jobId, code, updates }) {
    try {
      const series = await Series.findOne({ code });
      if (!series) {
        throw new Error('Series not found');
      }

      // 🔁 IMAGE REPLACEMENT — SAME AS series-create
      if (updates.imageUrl) {
        const image = await axios.get(updates.imageUrl, {
          responseType: 'arraybuffer',
        });

        const imageDir = path.join(__dirname, '..', 'images');
        if (!fs.existsSync(imageDir)) {
          fs.mkdirSync(imageDir, { recursive: true });
        }

        const imagePath = path.join(imageDir, `${code}.png`);
        fs.writeFileSync(imagePath, image.data);

        updates.localImagePath = imagePath;
        delete updates.imageUrl;
      }

      await Series.updateOne({ code }, { $set: updates });

      return {
        ok: true,
        jobId,
      };
    } catch (err) {
      return {
        ok: false,
        jobId,
        error: err.message,
      };
    }
  },
};
