const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const Card = require('../../../models/Card');
const User = require('../../../models/User');
const CardInventory = require('../../../models/CardInventory');
const generateVersion = require('../../utils/generateVersion');

const PACK_CONFIG = {
  selective: { cost: 500, keys: 0, cards: 5 },
  events: { cost: 400, keys: 4, cards: 4 },
  monthlies: { cost: 400, keys: 4, cards: 4 }
};

const eraByPack = {
  events: ['Fairytale Grove 2026', 'event2'],
  monthlies: ['January 2026', 'feb2024']
};

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const pack = interaction.options.getString('pack');
    const quantity = interaction.options.getInteger('quantity') || 1;
    let groups = [], names = [];
if (pack === 'selective') {
  groups = (interaction.options.getString('groups') || '').split(',').map(s => s.trim()).filter(Boolean);
  names = (interaction.options.getString('names') || '').split(',').map(s => s.trim()).filter(Boolean);
}

    const user = await User.findOne({ userId });
    if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });

    const { cost, keys, cards: cardsPerPack } = PACK_CONFIG[pack];
    const totalCost = cost * quantity;
    const totalKeys = keys * quantity;

    if (user.wirlies < totalCost || user.keys < totalKeys) {
      return interaction.editReply({
        content: `You need ${totalCost} Wirlies and ${totalKeys} Keys.`,
        ephemeral: true
      });
    }

    const allPulled = [];
    let pity = user.pityData?.[pack] || { count: 0, codes: [], lastUsed: null };
    let pityUsed = false;

    for (let i = 0; i < quantity; i++) {
      const packCards = [];

      for (let j = 0; j < cardsPerPack; j++) {
        let pool = [];

        if (pack === 'selective' && (groups.length || names.length)) {
          const isInputPick = Math.random() < 0.75;

          if (isInputPick) {
            if (groups.length && names.length && groups.length === names.length) {
              const pairs = groups.map((g, idx) => ({
                group: new RegExp(`^${g}$`, 'i'),
                name: new RegExp(`^${names[idx]}$`, 'i')
              }));

              pool = await Card.find({
                $or: pairs,
                version: { $in: [1, 2, 3, 4] },
                active: true
              }).lean();
            } else if (groups.length) {
              pool = await Card.find({
                group: { $in: groups.map(g => new RegExp(`^${g}$`, 'i')) },
                version: { $in: [1, 2, 3, 4] },
                active: true
              }).lean();
            } else if (names.length) {
              pool = await Card.find({
                name: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) },
                version: { $in: [1, 2, 3, 4] },
                active: true
              }).lean();
            }
          }
        }

        if ((pack === 'events' || pack === 'monthlies') && pity.count >= 5 && Math.random() < 0.8 && pity.codes?.length) {
          pool = await Card.find({
            cardCode: { $in: pity.codes },
            active: true
          }).lean();
          pityUsed = true;
        }

        // If pool is empty and it's selective, try user's categories
if (!pool.length && pack === 'selective' && user.enabledCategories?.length) {
  pool = await Card.find({
    active: true,
    version: { $in: [1, 2, 3, 4] },
    $or: [
      { category: { $in: user.enabledCategories } },
      { categoryalias: { $in: user.enabledCategories } }
    ]
  }).lean();
}

// If still empty and this is events/monthlies, pull based on era + version 5
if (!pool.length && (pack === 'events' || pack === 'monthlies')) {
  pool = await Card.find({
    active: true,
    version: 5,
    era: { $in: eraByPack[pack] }
  }).lean();
}

        if (pool.length) {
          const chosen = pool[Math.floor(Math.random() * pool.length)];
          packCards.push(chosen);
        }
      }

      allPulled.push(packCards);
      if (pack === 'events' || pack === 'monthlies') pity.count++;
    }

    user.wirlies -= totalCost;
    user.keys -= totalKeys;
    if (!user.pityData) user.pityData = {};

user.pityData[pack] = {
  count: pityUsed ? 0 : pity.count,
  codes: pity.codes,
  lastUsed: pityUsed ? new Date() : pity.lastUsed
};
    await user.save();
    // Update inventory
    for (const pack of allPulled) {
      for (const card of pack) {
        await CardInventory.updateOne(
          { userId, cardCode: card.cardCode },
          { $inc: { quantity: 1 } },
          { upsert: true }
        );
      }
    }

    // Paginate display
    const pages = allPulled.map((cards, index) => {
        const desc = cards.map(c => {
  const emoji = c.emoji || generateVersion(c);
  const eraText = c.era ? `( ${c.era} )` : '';
  return `• ${emoji} **${c.group}** __${c.name}__ ${eraText} \`${c.cardCode}\``;
}).filter(Boolean).join('\n');

      return new EmbedBuilder()
        .setTitle(`Pack ${index + 1} / ${allPulled.length}`)
        .setDescription(desc || '*No cards pulled.*')
        .setColor('#2f3136');
    });

    let currentPage = 0;

    const getRow = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === pages.length - 1)
    );

    const msg = await interaction.editReply({
      embeds: [pages[currentPage]],
      components: pages.length > 1 ? [getRow()] : [],
      fetchReply: true
    });

    if (pages.length <= 1) return;
    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async btn => {
      if (btn.user.id !== userId) {
        return btn.editReply({ content: 'These buttons aren’t for you.', ephemeral: true });
      }

      if (btn.customId === 'next' && currentPage < pages.length - 1) currentPage++;
      else if (btn.customId === 'prev' && currentPage > 0) currentPage--;

      await btn.update({
        embeds: [pages[currentPage]],
        components: [getRow()]
      });
    });

    collector.on('end', async () => {
      if (msg.editable) {
        await msg.edit({ components: [] });
      }
    });
  }
};
