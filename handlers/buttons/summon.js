const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const SummonSession = require('../../models/SummonSession');
const cooldowns = require('../../utils/cooldownManager');
const CardInventory = require('../../models/CardInventory');


const CLAIM_COOLDOWN = 30_000; // 30 seconds
const COOLDOWN_NAME = 'Claim';

module.exports = async function summonButtonHandler(interaction) {
  if (!interaction.customId.startsWith('summon:')) return;

  await interaction.deferUpdate();

  const index = Number(interaction.customId.split(':')[1]);
  if (Number.isNaN(index)) return;

  const messageId = interaction.message.id;

  const session = await SummonSession.findOne({ messageId });
  if (!session) {
    return interaction.followUp({
      content: 'This summon has expired.',
      components: [],
      ephemeral: true,
    });
  }

  const now = Date.now();

if (session.expiresAt && session.expiresAt.getTime() <= now) {
  // Disable all buttons globally
  const disabledRow = new ActionRowBuilder().addComponents(
    interaction.message.components[0].components.map(btn =>
      ButtonBuilder.from(btn).setDisabled(true)
    )
  );

  await interaction.message.edit({
    components: [disabledRow],
  });

  return interaction.followUp({
    content: 'This summon has expired.',
    ephemeral: true,
  });
}

  const card = session.cards[index];
  if (!card) return;

  // ❌ Already claimed
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

  // ⏳ Claim cooldown
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

  // 🚫 Owner claim rule (if you have one)
  if (
    interaction.user.id === session.ownerId &&
    session.ownerHasClaimed
  ) {
    return interaction.followUp({
      content: 'You already claimed a card from this summon.',
      ephemeral: true,
    });
  }

  // 🔒 Atomic claim in DB
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
    return interaction.followUp({
      content: 'Someone else claimed this card first.',
      ephemeral: true,
    });
  }

  // ✅ Update in-memory session (CRITICAL)
  session.cards[index].claimedBy = interaction.user.id;
  if (interaction.user.id === session.ownerId) {
    session.ownerHasClaimed = true;
  }

  await CardInventory.updateOne(
  {
    userId: interaction.user.id,
    cardCode: card.cardCode,
  },
  {
    $inc: { quantity: 1 },
  },
  { upsert: true }
);

  // 🎁 Give card (worker-safe if you already enqueue elsewhere)
  // If you already do this elsewhere, keep it there
  // Otherwise enqueue here

  await cooldowns.setCooldown(
    interaction.user.id,
    COOLDOWN_NAME,
    CLAIM_COOLDOWN
  );

  await interaction.followUp({
    content: `You claimed **${card.cardCode}**`,
    ephemeral: true,
  });

  // 🔄 Rebuild buttons from SESSION STATE (authoritative)
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

  await interaction.message.edit({
    components: [newRow],
  });
};