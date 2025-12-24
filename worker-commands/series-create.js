// src/worker-commands/series-create.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Series = require('../models/Series');

module.exports = {
  async execute(data) {
    const jobId = data.jobId;

    try {
      if (!data.code) throw new Error('Missing series code');
      if (!data.name) throw new Error('Missing name');
      if (!data.imageUrl) throw new Error('Missing image');

      // SAME image handling pattern as cards
      const image = await axios.get(data.imageUrl, { responseType: 'arraybuffer' });

      const imageDir = path.join(__dirname, '..', 'images');
      if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

      const imagePath = path.join(imageDir, `${data.code}.png`);
      fs.writeFileSync(imagePath, image.data);

      await Series.create({
        code: data.code,
        name: data.name,
        description: data.description,
        localImagePath: imagePath,
        createdBy: data.userId
      });

      return {
        ok: true,
        jobId,
        code: data.code
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
