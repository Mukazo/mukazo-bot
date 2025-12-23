// utils/queueWithReply.js
const { enqueueInteraction } = require('../queue');

async function queueWithReply(interaction, extra = {}) {
    await interaction.deferReply();
  return await enqueueInteraction(interaction, extra);
}

module.exports = { queueWithReply };