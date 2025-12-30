const SummonSession = require('../../models/SummonSession');
const CardInventory = require('../../models/CardInventory');

module.exports = async function handleSummonButton(interaction) {
  const index = Number(interaction.customId.split(':')[1]);
  const messageId = interaction.message.id;

  // Correct acknowledgement for message component
  await interaction.deferUpdate();

  const session = await SummonSession.findOne({ messageId });

  if (!session || session.expiresAt < new Date()) {
    return interaction.followUp({
      content: 'This summon has expired.',
      ephemeral: true,
    });
  }

  if (!session.cards[index]) {
    return interaction.followUp({
      content: 'Invalid card.',
      ephemeral: true,
    });
  }

  if (session.cards[index].claimedBy) {
    return interaction.followUp({
      content: 'This card was already claimed.',
      ephemeral: true,
    });
  }

  if (!session.ownerHasClaimed && interaction.user.id !== session.ownerId) {
    return interaction.followUp({
      content: 'Wait until the summoner claims first.',
      ephemeral: true,
    });
  }

  if (session.cards.some(c => c.claimedBy === interaction.user.id)) {
    return interaction.followUp({
      content: 'You already claimed a card.',
      ephemeral: true,
    });
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
    return interaction.followUp({
      content: 'This card was already claimed.',
      ephemeral: true,
    });
  }

  const cardCode = session.cards[index].cardCode;

  await CardInventory.updateOne(
    { userId: interaction.user.id, cardCode },
    { $inc: { quantity: 1 } },
    { upsert: true }
  );

  // Send private confirmation FIRST
  await interaction.followUp({
    content: `You claimed **${cardCode}**`,
    ephemeral: true,
  });

  // Disable the clicked button
  const row = interaction.message.components[0];
  row.components[index].setDisabled(true);

  await interaction.message.edit({ components: [row] });
};
