require('dotenv').config();

const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const path = require('path');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
};

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Mukazo Worker MongoDB connected');

  const worker = new Worker(
    'discord-tasks',
    async job => {
      console.log('[WORKER] processing:', job.name, job.data.jobId);

      const handlerPath = path.join(__dirname, 'worker-commands', job.name);
      const handler = require(handlerPath);

      const result = await handler.execute(job.data);

      console.log('[WORKER] completed:', result);

      return result;
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error('[WORKER FAILED]', job?.name, job?.data?.jobId, err);
  });

  console.log('Mukazo Worker online');
}

start().catch(err => {
  console.error('[WORKER START ERROR]', err);
  process.exit(1);
});