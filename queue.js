// src/queue.js
const { Queue, QueueEvents } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
};

const QUEUE_NAME = 'discord-tasks';

const queue = new Queue(QUEUE_NAME, { connection });
const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

const listeners = new Set();

function listenForResults(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb); // 🔥 CRITICAL cleanup
}

queueEvents.on('completed', ({ returnvalue }) => {
  for (const cb of listeners) cb(returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  for (const cb of listeners) {
    cb({ ok: false, jobId, error: failedReason });
  }
});


async function enqueueInteraction(jobName, payload) {
  return queue.add(jobName, payload, {
    removeOnComplete: true,
    removeOnFail: true,
  });
}

module.exports = {
  enqueueInteraction,
  listenForResults,
};
