const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Card = require('../../models/Card');
const User = require('../../models/User');
const CardInventory = require('../../models/CardInventory');
const generateVersion = require('../../utils/generateVersion');

// Use Discord Role IDs for accurate tier detection
const ROLE_TIERS = {
  '1465789192326873231': { name: 'Pixie', limit: 18, chance: 0.8 },
  '1447006809419415622': { name: 'Stardust', limit: 15, chance: 0.7 },
  '1447006766733725747': { name: 'Ethereal', limit: 12, chance: 0.6 },
  '1447006737042378772': { name: 'Daydream', limit: 10, chance: 0.55 }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cast')
    .setDescription('Cast a spell for an active V5 card.')
    .addStringOption(option =>
      option.setName('cardcode')
        .setDescription('Version 5 card code')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const codeInput = interaction.options.getString('cardcode')?.trim().toUpperCase();

    const user = await User.findOne({ userId });
    if (!user) {
      return interaction.editReply({
        content: 'User not found.',
        ephemeral: true
      });
    }

    // Identify the user's highest Patreon tier role
    const memberRoleIds = interaction.member.roles.cache.map(role => role.id);
    const matchedEntry = Object.entries(ROLE_TIERS).find(([roleId]) =>
      memberRoleIds.includes(roleId)
    );

    if (!matchedEntry) {
      return interaction.editReply({
        content: 'You need Patreon role to use this command.',
        ephemeral: true
      });
    }

    const [, { name: tierName, limit, chance }] = matchedEntry;

    // Monthly tracking
    const now = new Date();
    const currentMonth = now.getMonth();

    if (!user.castData || user.castData.month !== currentMonth) {
      user.castData = { used: 0, month: currentMonth };
    }

    if (!user.monthlyLimitBoosts) {
      user.monthlyLimitBoosts = {
        cast: { extra: 0, month: currentMonth },
        brew: { extra: 0, month: currentMonth }
      };
    }
    if (!user.monthlyLimitBoosts.cast) {
      user.monthlyLimitBoosts.cast = { extra: 0, month: currentMonth };
    }

    // Reset boost if month changed
    if (user.monthlyLimitBoosts.cast.month !== currentMonth) {
      user.monthlyLimitBoosts.cast.extra = 0;
      user.monthlyLimitBoosts.cast.month = currentMonth;
    }

    const extraLimit = user.monthlyLimitBoosts.cast.extra || 0;
    const effectiveLimit = limit + extraLimit;

    if (user.castData.used >= effectiveLimit) {
      return interaction.followUp({
        content: `You've reached your monthly limit for Patreon **${tierName}** Tier.`,
        ephemeral: true
      });
    }

    if ((user.wirlies || 0) < 2500) {
      return interaction.editReply({
        content: 'You need <:Wirlies:1455924065972785375> **2,500** to cast.',
        ephemeral: true
      });
    }

    // Validate requested card FIRST
    const targetCard = await Card.findOne({
      cardCode: codeInput,
      version: 5,
      active: true
    });

    if (!targetCard) {
      return interaction.editReply({
        content: `\`${codeInput}\` is not a valid active Version 5 card code.`,
        ephemeral: true
      });
    }

    // Roll chance ONLY after validation passes
    let pulledCard = null;

    if (Math.random() < chance) {
      pulledCard = targetCard;
    } else {
      // Fallback to random active V5 card from user categories
      const filter = {
        version: 5,
        active: true,
        $or: []
      };

      if (user.enabledCategories?.length) {
        filter.$or.push({ category: { $in: user.enabledCategories } });
        filter.$or.push({ categoryalias: { $in: user.enabledCategories } });
      }

      if (!filter.$or.length) delete filter.$or;

      const pool = await Card.find(filter).lean();
      if (!pool.length) {
        return interaction.editReply({
          content: 'No valid cards found to cast.',
          ephemeral: true
        });
      }

      pulledCard = pool[Math.floor(Math.random() * pool.length)];
    }

    // Save to inventory
    await CardInventory.updateOne(
      { userId, cardCode: pulledCard.cardCode },
      { $inc: { quantity: 1 } },
      { upsert: true }
    );

    user.castData.used++;
    user.wirlies -= 2500;
    await user.save();

    const image = pulledCard.localImagePath
      ? `attachment://${pulledCard._id}.png`
      : pulledCard.discordPermalinkImage || pulledCard.imgurImageLink;

    const pulls = [pulledCard];

    const fields = pulls.map(card => ({
      name: `Version — ${card.emoji || generateVersion(card)}`,
      value: [
        `**Group:** ${card.group}`,
        `**Name:** ${card.name}`,
        card.era ? `**Era:** ${card.era}` : null,
        `> **Code:** \`${card.cardCode}\``,
      ].filter(Boolean).join('\n'),
      inline: true,
    }));

    const embed = new EmbedBuilder()
      .setDescription('## A Whimsical Casting . .')
      .addFields(fields)
      .setImage(image)
      .setFooter({
        text: `Used ${user.castData.used}/${effectiveLimit} for Patreon ${tierName} Tier this month.`
      });

    const files = pulledCard.localImagePath
      ? [{ attachment: pulledCard.localImagePath, name: `${pulledCard._id}.png` }]
      : [];

    return interaction.editReply({ embeds: [embed], files });
  }
};