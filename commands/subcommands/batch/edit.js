const Batch = require('../../../models/Batch');
const Card = require('../../../models/Card');

module.exports = {
async execute(interaction) {

const code = interaction.options.getString('code').toLowerCase();
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description');
      const releaseStr = interaction.options.getString('releaseat');
      const releaseNow = interaction.options.getBoolean('releasenow');
      const deactivateStr = interaction.options.getString('deactivateat');


      const batch = await Batch.findOne({ code });
      if (!batch) {
        return interaction.editReply({ content: `No batch found with code \`${code}\`.`, ephemeral: true });
      }

      const updates = {};

      if (name) updates.name = name;
      if (description) updates.description = description;
      if (releaseStr) {
        const parsed = new Date(releaseStr);
        if (isNaN(parsed)) {
          return interaction.editReply({ content: 'Invalid date format.', ephemeral: true });
        }
        updates.releaseAt = parsed;
      }

if (deactivateStr) {
  const parsed = new Date(deactivateStr);
  if (isNaN(parsed)) {
    return interaction.editReply({ content: 'Invalid deactivate date format.', ephemeral: true });
  }
  updates.deactivateCardsAt = parsed;

  // 🔁 Retroactively update all cards in this batch
  await Card.updateMany(
    { batch: code },
    { $set: { deactivateAt: parsed } }
  );
}
    const active = interaction.options.getBoolean('active');
const untilStr = interaction.options.getString('until');

if (active !== null || untilStr) {
  const updateCards = {};

  if (active !== null) {
    updateCards.active = active;
  }

  if (untilStr) {
    const parsed = new Date(untilStr);
    if (isNaN(parsed)) {
      return interaction.editReply({ content: 'Invalid until date.', ephemeral: true });
    }
    updateCards.deactivateAt = parsed;
    updates.deactivateCardsAt = parsed; // batch model
  }

  await Card.updateMany({ batch: code }, { $set: updateCards });
}


      if (releaseNow === true) {
        updates.releaseAt = new Date();
      }

      await Batch.updateOne({ code }, { $set: updates });

      // AUTO-RELEASE CARDS IF BATCH RELEASED NOW
      if (releaseNow === true || (releaseStr && new Date(releaseStr) <= new Date())) {
        await Card.updateMany({ batch: code }, { $set: { batch: null } });
      }

      return interaction.editReply({
        content: `Batch \`${code}\` updated.` + (releaseNow ? ' All assigned cards are now released!' : ''),
        ephemeral: false
      });
    }
  };