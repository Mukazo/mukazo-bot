// src/queue.js
const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
};

const queue = new Queue('discord-tasks', { connection });

const listeners = new Set();

async function enqueueInteraction(jobName, payload) {
  await queue.add(jobName, payload, {
    removeOnComplete: true,
    removeOnFail: true
  });
}

function listenForResults(cb) {
  listeners.add(cb);
}

queue.on('completed', job => {
  for (const cb of listeners) {
    cb(job.returnvalue);
  }
});

module.exports = {
  enqueueInteraction,
  listenForResults
};
