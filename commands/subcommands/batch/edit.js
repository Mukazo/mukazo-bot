const Batch = require('../../../models/Batch');
const Card = require('../../../models/Card');

module.exports = {
async execute(interaction) {

const code = interaction.options.getString('code').toLowerCase();
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description');
      const releaseStr = interaction.options.getString('releaseat');
      const releaseNow = interaction.options.getBoolean('releasenow');

      const batch = await Batch.findOne({ code });
      if (!batch) {
        return interaction.reply({ content: `No batch found with code \`${code}\`.`, ephemeral: true });
      }

      const updates = {};

      if (name) updates.name = name;
      if (description) updates.description = description;
      if (releaseStr) {
        const parsed = new Date(releaseStr);
        if (isNaN(parsed)) {
          return interaction.reply({ content: 'Invalid date format.', ephemeral: true });
        }
        updates.releaseAt = parsed;
      }

      if (releaseNow === true) {
        updates.releaseAt = new Date();
      }

      await Batch.updateOne({ code }, { $set: updates });

      // AUTO-RELEASE CARDS IF BATCH RELEASED NOW
      if (releaseNow === true || (releaseStr && new Date(releaseStr) <= new Date())) {
        await Card.updateMany({ batch: code }, { $set: { batch: null } });
      }

      return interaction.reply({
        content: `Batch \`${code}\` updated.` + (releaseNow ? ' All assigned cards are now released!' : ''),
        ephemeral: false
      });
    }
  };