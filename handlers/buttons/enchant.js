const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const SummonSession = require('../../models/SummonSession');
const CardInventory = require('../../models/CardInventory');
const { emitQuestEvent } = require('../../utils/quest/tracker');

module.exports = async function handleEnchantButton(interaction) {
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
      content: 'This enchant has expired.',
      ephemeral: true,
    });
  }

  // 🔒 Owner-only
  if (interaction.user.id !== session.ownerId) {
    return interaction.followUp({
      content: 'Only the caster of this enchant may claim a card.',
      ephemeral: true,
    });
  }

  if (!session.cards[index]) {
    return interaction.followUp({
      content: 'Invalid card.',
      ephemeral: true,
    });
  }

  // Owner can claim only one total
  if (session.cards.some(c => c.claimedBy === session.ownerId)) {
    const disabledRow = disableAllButtons(interaction.message);
    await interaction.message.edit({ components: [disabledRow] });

    return interaction.followUp({
      content: 'You already claimed a card from this enchant.',
      ephemeral: true,
    });
  }

  // Card already claimed
  if (session.cards[index].claimedBy) {
    return interaction.followUp({
      content: 'This card was already claimed.',
      ephemeral: true,
    });
  }

  // Atomic claim (prevents double-claim fast clicking)
  const result = await SummonSession.updateOne(
    {
      messageId,
      [`cards.${index}.claimedBy`]: null,
    },
    {
      $set: {
        [`cards.${index}.claimedBy`]: session.ownerId,
        ownerHasClaimed: true,
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
    { userId: session.ownerId, cardCode },
    { $inc: { quantity: 1 } },
    { upsert: true }
  );

  const inventory = await CardInventory.findOne({ userId: interaction.user.id, cardCode: cardCode });
  const quantity = inventory?.quantity || 1;

  await emitQuestEvent(session.ownerId, {
  type: 'enchant',
  card: {
    cardCode,
    version: session.cards[index].version,
    group: session.cards[index].group,
    era: session.cards[index].era,
  },
});

  await interaction.followUp({
    content: `You claimed **${cardCode}**. You now have **${quantity}** copies.`,
    ephemeral: true,
  });

  // Disable ALL buttons after claim (since nobody else can claim anyway)
  const disabledRow = disableAllButtons(interaction.message);
  await interaction.message.edit({ components: [disabledRow] });
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