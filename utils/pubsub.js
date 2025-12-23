// utils/pubsub.js
const { createClient } = require('redis');

const pub = createClient();
const sub = createClient();

(async () => {
  await pub.connect();
  await sub.connect();
})();

module.exports = { pub, sub };
