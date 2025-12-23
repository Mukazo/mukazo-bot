// commands/subcommands/card/create.js
const { enqueueInteraction } = require('../../../queue');

module.exports = {
  data: {
    name: 'create',
  },
  async execute(interaction) {
    await enqueueInteraction(interaction);
  }
};
