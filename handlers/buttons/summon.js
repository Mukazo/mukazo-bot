const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const SummonSession = require('../../models/SummonSession');
const cooldowns = require('../../utils/cooldownManager');
const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const { emitQuestEvent } = require('../../utils/quest/tracker');

const CLAIM_COOLDOWN = 30_000; // 30 seconds
const COOLDOWN_NAME = 'Claim';

module.exports = async function summonButtonHandler(interaction) {
  if (!interaction.customId.startsWith('summon:')) return;

  await interaction.deferUpdate();

  const index = Number(interaction.customId.split(':')[1]);
  if (Number.isNaN(index)) return;

  const messageId = interaction.message.id;
  const session = await SummonSession.findOne({ messageId });
  const now = Date.now();

  if (!session) {
    console.log('[SUMMON DEBUG] No session found for message', messageId);
    return;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now) {
    console.log('[SUMMON DEBUG] Session expired');

    const disabledRow = new ActionRowBuilder().addComponents(
      interaction.message.components[0].components.map(btn =>
        ButtonBuilder.from(btn).setDisabled(true)
      )
    );

    await interaction.message.edit({ components: [disabledRow] });

    return interaction.followUp({
      content: 'This summon has expired.',
      ephemeral: true,
    });
  }

  const card = session.cards[index];
  if (!card) {
    console.log('[SUMMON DEBUG] Card index invalid', index);
    return;
  }

  console.log('[SUMMON DEBUG] Claim attempt', {
    userId: interaction.user.id,
    cardCode: card.cardCode,
    version: card.version,
    group: card.group,
    era: card.era,
  });

  if (card.claimedBy) {
    return interaction.followUp({
      content: 'This card has already been claimed.',
      ephemeral: true,
    });
  }

  if (!session.ownerHasClaimed && interaction.user.id !== session.ownerId) {
    return interaction.followUp({
      content: 'Wait until the summoner claims first.',
      ephemeral: true,
    });
  }

  if (await cooldowns.isOnCooldown(interaction.user.id, COOLDOWN_NAME)) {
    const ts = await cooldowns.getCooldownTimestamp(
      interaction.user.id,
      COOLDOWN_NAME
    );

    return interaction.followUp({
      content: `You can claim again ${ts}.`,
      ephemeral: true,
    });
  }

  if (
    interaction.user.id === session.ownerId &&
    session.ownerHasClaimed
  ) {
    return interaction.followUp({
      content: 'You already claimed a card from this summon.',
      ephemeral: true,
    });
  }

  const result = await SummonSession.updateOne(
    {
      _id: session._id,
      [`cards.${index}.claimedBy`]: null,
    },
    {
      $set: {
        [`cards.${index}.claimedBy`]: interaction.user.id,
        ownerHasClaimed:
          interaction.user.id === session.ownerId ||
          session.ownerHasClaimed,
      },
    }
  );

  if (result.modifiedCount === 0) {
    console.log('[SUMMON DEBUG] Atomic claim failed');
    return interaction.followUp({
      content: 'Someone else claimed this card first.',
      ephemeral: true,
    });
  }

  session.cards[index].claimedBy = interaction.user.id;
  if (interaction.user.id === session.ownerId) {
    session.ownerHasClaimed = true;
  }

  await CardInventory.updateOne(
    { userId: interaction.user.id, cardCode: card.cardCode },
    { $inc: { quantity: 1 } },
    { upsert: true }
  );

  console.log('[SUMMON DEBUG] Emitting quest event');
  console.log('[SUMMON DEBUG] emitQuestEvent typeof:', typeof emitQuestEvent);

  // 🔥 FETCH FULL CARD DATA FIRST
const fullCard = await Card.findOne({ cardCode: card.cardCode }).lean();

if (!fullCard) {
  console.error('[SUMMON DEBUG] Card not found in DB:', card.cardCode);
  return;
}

console.log('[SUMMON DEBUG] Full card loaded for quest:', {
  cardCode: fullCard.cardCode,
  version: fullCard.version,
  group: fullCard.group,
  era: fullCard.era,
});

await emitQuestEvent(
  interaction.user.id,
  {
    type: 'summon',
    card: {
      cardCode: fullCard.cardCode,
      version: fullCard.version,
      group: fullCard.group,
      era: fullCard.era,
    },
  },
  interaction
);

  await cooldowns.setCooldown(
    interaction.user.id,
    COOLDOWN_NAME,
    CLAIM_COOLDOWN
  );

  await interaction.followUp({
    content: `You claimed **${card.cardCode}**`,
    ephemeral: true,
  });

  const oldRow = interaction.message.components[0];

  const newRow = new ActionRowBuilder().addComponents(
    session.cards.map((c, i) =>
      new ButtonBuilder()
        .setCustomId(`summon:${i}`)
        .setLabel(oldRow.components[i].label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(Boolean(c.claimedBy))
    )
  );

  await interaction.message.edit({ components: [newRow] });
};
