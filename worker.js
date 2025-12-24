require('dotenv').config();
const { Worker } = require('bullmq');
const path = require('path');

new Worker('discord-tasks', async job => {
  const commandModule = require(path.join(__dirname, 'worker-commands', job.name));
  return await commandModule.execute(job.data);
}, {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});
