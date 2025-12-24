const { Queue, QueueScheduler, Worker } = require('bullmq');
const connection = { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT };

const interactionQueue = new Queue('discord-tasks', { connection });
new QueueScheduler('discord-tasks', { connection });

const enqueueInteraction = async (jobName, payload) => {
  await interactionQueue.add(jobName, payload, {
    removeOnComplete: true,
    removeOnFail: true,
  });
};

// Result listeners
const listeners = new Set();
const listenForResults = (cb) => listeners.add(cb);

// Worker for completed events
interactionQueue.on('completed', ({ id, returnvalue }) => {
  for (const cb of listeners) {
    cb(returnvalue);
  }
});

module.exports = { enqueueInteraction, listenForResults };
