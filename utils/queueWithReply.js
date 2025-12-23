// utils/queueWithReply.js
const { enqueueInteraction } = require('../queue');

async function queueWithReply(interaction, extra = {}) {
  return await enqueueInteraction(interaction, extra);
}

module.exports = { queueWithReply };