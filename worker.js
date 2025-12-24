// src/worker.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const path = require('path');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Worker MongoDB connected');

  new Worker(
    'discord-tasks',
    async job => {
      const handler = require(
        path.join(__dirname, 'worker-commands', job.name)
      );
      return handler.execute(job.data);
    },
    {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    }
  );

  console.log('🧵 Worker online');
})();
