// commands/subcommands/card/create.js
const { enqueueInteraction } = require('../../../queue');

module.exports = {
  data: {
    name: 'create',
  },
  async execute(interaction) {

    await interaction.deferReply();
    console.log('[create] token after defer:', interaction.token); // <== should not be undefined
    await enqueueInteraction(interaction);
  }
};
