const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const SummonSession = require('../../models/SummonSession');
const CardInventory = require('../../models/CardInventory');

module.exports = async function handleSummonButton(interaction) {
  const index = Number(interaction.customId.split(':')[1]);
  const messageId = interaction.message.id;

  await interaction.deferUpdate();

  const session = await SummonSession.findOne({ messageId });

  /* ===========================
     EXPIRED — DISABLE ALL
  =========================== */
  if (!session || session.expiresAt < new Date()) {
    const disabledRow = disableAllButtons(interaction.message);

    await interaction.message.edit({ components: [disabledRow] });

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

  /* ===========================
     SUCCESS — DISABLE CLICKED
  =========================== */

  await interaction.followUp({
    content: `You claimed **${cardCode}**`,
    ephemeral: true,
  });

  const oldRow = interaction.message.components[0];

  const newRow = new ActionRowBuilder().addComponents(
    oldRow.components.map((btn, i) =>
      ButtonBuilder.from(btn).setDisabled(i === index)
    )
  );

  await interaction.message.edit({ components: [newRow] });
};

/* ===========================
   HELPERS
=========================== */

function disableAllButtons(message) {
  const oldRow = message.components[0];

  return new ActionRowBuilder().addComponents(
    oldRow.components.map(btn =>
      ButtonBuilder.from(btn).setDisabled(true)
    )
  );
}
