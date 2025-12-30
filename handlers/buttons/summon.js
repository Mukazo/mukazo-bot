const { ButtonStyle } = require('discord.js');
const SummonSession = require('../../models/SummonSession');
const CardInventory = require('../../models/CardInventory');

module.exports = async function handleSummonButton(interaction) {
  const index = Number(interaction.customId.split(':')[1]);
  const messageId = interaction.message.id;

  await interaction.deferUpdate();

  const session = await SummonSession.findOne({ messageId });

  if (!session || session.expiresAt < new Date()) {
    return interaction.followUp('This summon has expired.');
  }

  if (!session.cards[index]) {
    return interaction.followUp('Invalid card.');
  }

  if (session.cards[index].claimedBy) {
    return interaction.followUp('This card was already claimed.');
  }

  if (!session.ownerHasClaimed && interaction.user.id !== session.ownerId) {
    return interaction.followUp('Wait until the summoner claims first.');
  }

  if (session.cards.some(c => c.claimedBy === interaction.user.id)) {
    return interaction.followUp('You already claimed a card.');
  }

  const result = await SummonSession.updateOne(
    {
      messageId,
      [`cards.${index}.claimedBy`]: null,
    },
    {
      $set: {
        [`cards.${index}.claimedBy`]: interaction.user.id,
        ownerHasClaimed:
          interaction.user.id === session.ownerId || session.ownerHasClaimed,
      },
    }
  );

  if (result.modifiedCount === 0) {
    return interaction.followUp('This card was already claimed.');
  }

  const cardCode = session.cards[index].cardCode;

  await CardInventory.updateOne(
    { userId: interaction.user.id, cardCode },
    { $inc: { quantity: 1 } },
    { upsert: true }
  );

  // Disable the clicked button
  const row = interaction.message.components[0];
  row.components[index]
    .setDisabled(true)

  await interaction.message.edit({ components: [row] });

  await interaction.followUp(`You claimed **${cardCode}**`);
};
