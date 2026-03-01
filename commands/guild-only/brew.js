const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Card = require('../../models/Card');
const User = require('../../models/User');
const CardInventory = require('../../models/CardInventory');

// Use Discord Role IDs for accurate tier detection
const ROLE_TIERS = {
  '1465789192326873231': { name: 'Pixie', limit: 7, chance: 0.65 },
  '1447006809419415622': { name: 'Stardust', limit: 5, chance: 0.55 },
  '1447006766733725747': { name: 'Ethereal', limit: 3, chance: 0.5 },
  '1447006737042378772': { name: 'Daydream', limit: 2, chance: 0.45 }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('brew')
    .setDescription('Brew a potion for an inactive V5 card.')
    .addStringOption(option =>
      option.setName('cardcode')
        .setDescription('Version 5 card code')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const codeInput = interaction.options.getString('cardcode')?.toUpperCase();

    const user = await User.findOne({ userId });
    if (!user) return interaction.editReply({ content: 'User not found.', ephemeral: true });

    // Identify the user's highest Patreon tier role
    const memberRoleIds = interaction.member.roles.cache.map(role => role.id);
    const matchedEntry = Object.entries(ROLE_TIERS).find(([roleId]) => memberRoleIds.includes(roleId));

    if (!matchedEntry) {
      return interaction.editReply({ content: 'You need Patreon role to use this command.', ephemeral: true });
    }

    const [matchedRoleId, { name: tierName, limit, chance }] = matchedEntry;

    // Initialize monthly tracking
    const now = new Date();
    const currentMonth = now.getMonth();
    if (!user.brewData || user.brewData.month !== currentMonth) {
      user.brewData = { used: 0, month: currentMonth };
    }

    if (user.brewData.used >= limit) {
      return interaction.followUp({ content: `You've reached your monthly limit for Patreon **${tierName}** Tier.`, ephemeral: true });
    }

    if (user.wirlies < 5000) {
      return interaction.editReply({ content: 'You need <:Wirlies:1455924065972785375> **5,000** to cast.', ephemeral: true });
    }

    let pulledCard = null;

    // Try to get the requested card
    if (codeInput) {
      const targetCard = await Card.findOne({ cardCode: codeInput, version: 5, active: false });
      if (targetCard && Math.random() < chance) {
        pulledCard = targetCard;
      }
    }

    // Fallback to random active V5 card from user categories
    if (!pulledCard) {
      const filter = {
        version: 5,
        active: false,
        $or: []
      };

      if (user.enabledCategories?.length) {
        filter.$or.push({ category: { $in: user.enabledCategories } });
        filter.$or.push({ categoryalias: { $in: user.enabledCategories } });
      }

      if (!filter.$or.length) delete filter.$or;

      const pool = await Card.find(filter).lean();
      if (!pool.length) {
        return interaction.editReply({ content: 'No valid cards found to cast.', ephemeral: true });
      }

      pulledCard = pool[Math.floor(Math.random() * pool.length)];
    }

    // Save to inventory
    await CardInventory.updateOne(
      { userId, cardCode: pulledCard.cardCode },
      { $inc: { quantity: 1 } },
      { upsert: true }
    );

    user.brewData.used++;
    user.wirlies -= 5000;
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
      .setDescription([
        '## A Whimsical Casting . .'
        ].filter(Boolean).join('\n'))
      .addFields(fields)
      .setImage(image)
      .setFooter({ text: `Used ${user.brewData.used}/${limit} for Patreon ${tierName} Tier this month.` });

    const files = pulledCard.localImagePath
      ? [{ attachment: pulledCard.localImagePath, name: `${pulledCard._id}.png` }]
      : [];

    return interaction.editReply({ embeds: [embed], files });
  }
};
