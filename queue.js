const { Queue, QueueEvents } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
};

const QUEUE_NAME = 'discord-tasks';

const queue = new Queue(QUEUE_NAME, { connection });
const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

const listeners = new Set();

function listenForResults(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

queueEvents.on('completed', ({ returnvalue }) => {
  if (!returnvalue) return;

  for (const cb of listeners) {
    cb(returnvalue);
  }
});

queueEvents.on('failed', ({ failedReason }) => {
  console.error('[QUEUE JOB FAILED]', failedReason);
});

async function enqueueInteraction(jobName, payload) {
  console.log('[QUEUE] adding job:', jobName, payload.jobId);

  return queue.add(jobName, payload, {
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
      count: 1000,
    },
  });
}

module.exports = {
  enqueueInteraction,
  listenForResults,
};