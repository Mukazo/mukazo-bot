const { enqueueInteraction } = require('../queue');

async function queueWithReply(interaction, extra = {}) {
  // 💥 only defer if we're running on real Discord interaction
  if (typeof interaction?.deferReply === 'function') {
    try {
      await interaction.deferReply();
    } catch (e) {
      console.warn('⚠️ Could not defer reply:', e.message);
    }
  }

  return enqueueInteraction(interaction, extra);
}

module.exports = { queueWithReply };