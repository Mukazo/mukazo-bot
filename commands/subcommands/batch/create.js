const Batch = require('../../models/Batch');

module.exports = {
async execute(interaction) {

    // CREATE
      const code = interaction.options.getString('code').toLowerCase();
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description') || '';
      const releaseStr = interaction.options.getString('releaseat');

      const releaseAt = new Date(releaseStr);
      if (isNaN(releaseAt)) {
        return interaction.reply({ content: 'Invalid date format. Use YYYY-MM-DD.', flags: 1 << 6 });
      }

      const existing = await Batch.findOne({ code });
      if (existing) {
        return interaction.reply({ content: `Batch with code \`${code}\` already exists.`, flags: 1 << 6 });
      }

      await Batch.create({ code, name, description, releaseAt });
      return interaction.reply({ content: `Batch \`${name}\` created!`, flags: 1 << 6 });
    }
  };