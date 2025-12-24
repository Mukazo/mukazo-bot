// src/worker.js
require('dotenv').config();
const { Worker } = require('bullmq');
const path = require('path');

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
      port: process.env.REDIS_PORT
    }
  }
);

console.log('🧵 Worker online');
