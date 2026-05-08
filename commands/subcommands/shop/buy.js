const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const Card = require('../../../models/Card');
const User = require('../../../models/User');
const { emitQuestEvent } = require('../../../utils/quest/tracker');
const CardInventory = require('../../../models/CardInventory');
const generateVersion = require('../../../utils/generateVersion');
const { getPullPool } = require('../../../utils/pullPoolCache');

const PACK_CONFIG = {
  selective: { cost: 750, keys: 0, cards: 5 },
  events: { cost: 675, keys: 4, cards: 4 },
  monthlies: { cost: 675, keys: 4, cards: 4 }
};

const eraByPack = {
  events: ['Pola Pairs', 'Mukazo Style', 'The Corrupted City'],
  monthlies: ['April 2026', 'May 2026', 'June 2026', 'July 2026']
};

function parseCsv(input) {
  return (input || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseMulti(input) {
  if (!input) return [];

  const trimmed = input.trim();

  const match = trimmed.match(/^\((.+)\)$/);

  if (match) {
    return match[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function randomFrom(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)] || null;
}

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const pack = interaction.options.getString('pack');
    const quantity = interaction.options.getInteger('quantity') || 1;

    let groups = [];
    let names = [];
    let eras = [];

    if (pack === 'selective') {
      groups = parseMulti(interaction.options.getString('groups'));
names = parseMulti(interaction.options.getString('names'));
eras = parseMulti(interaction.options.getString('eras'));
    }

    const user = await User.findOne({ userId });
    if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });

    const { cost, keys, cards: cardsPerPack } = PACK_CONFIG[pack];
    if (!cost && cost !== 0) {
      return interaction.editReply({
        content: 'Invalid pack selected.',
        ephemeral: true
      });
    }

    const totalCost = cost * quantity;
    const totalKeys = keys * quantity;

    if (user.wirlies < totalCost || user.keys < totalKeys) {
      return interaction.editReply({
        content: `You need ${totalCost} Wirlies and ${totalKeys} Keys.`,
        ephemeral: true
      });
    }

    const allPulled = [];

    if (!user.pityData) user.pityData = new Map();
    let pity = user.pityData.get(pack) || { count: 0, codes: [], lastUsed: null };
    let pityUsedThisSession = false;

    // Shared cached pools
    let selectiveFallbackPool = [];
    let eventMonthlyV5Pool = [];

    if (pack === 'selective' && user.enabledCategories?.length) {
      const [v1, v2, v3, v4] = await Promise.all([
        getPullPool(1, user),
        getPullPool(2, user),
        getPullPool(3, user),
        getPullPool(4, user),
      ]);

      selectiveFallbackPool = [
        ...v1.cards,
        ...v2.cards,
        ...v3.cards,
        ...v4.cards,
      ];
    }
    if (pack === 'events' || pack === 'monthlies') {
      const v5 = await getPullPool(5, user);
      eventMonthlyV5Pool = v5.cards.filter(card => eraByPack[pack].includes(card.era));
    }

    for (let i = 0; i < quantity; i++) {
      const packCards = [];

      let pityTriggered = false;

      for (let j = 0; j < cardsPerPack; j++) {
        let pool = [];

        if (pack === 'selective' && (groups.length || names.length || eras.length)) {
          const isInputPick = Math.random() < 0.65;

          if (isInputPick) {
            if (groups.length && names.length) {
              if (groups.length === names.length) {
                const pairs = groups.map((g, idx) => {
  const safeGroup = escapeRegex(g);
  const safeName = escapeRegex(names[idx]);

  return {
    $or: [
      {
        group: new RegExp(`^${safeGroup}$`, 'i'),
        $or: [
          { name: new RegExp(`^${safeName}$`, 'i') },
          { namealias: new RegExp(`^${safeName}$`, 'i') }
        ]
      },
      {
        groupalias: new RegExp(`^${safeGroup}$`, 'i'),
        $or: [
          { name: new RegExp(`^${safeName}$`, 'i') },
          { namealias: new RegExp(`^${safeName}$`, 'i') }
        ]
      }
    ]
  };
});

                pool = await Card.find({
                  $or: pairs,
                  version: { $in: [1, 2, 3, 4] },
                  active: true,
                  batch: null
                })
                  .select('cardCode group name era emoji version localImagePath')
                  .lean();
              } else {
                pool = await Card.find({
                  group: { $in: groups.map(g => new RegExp(`^${g}$`, 'i')) },
                  $or: [
                    { name: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) } },
                    { namealias: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) } }
                  ],
                  version: { $in: [1, 2, 3, 4] },
                  active: true,
                  batch: null
                })
                  .select('cardCode group name era emoji version localImagePath')
                  .lean();
              }
            } else if (groups.length) {
              pool = await Card.find({
                group: { $in: groups.map(g => new RegExp(`^${g}$`, 'i')) },
                version: { $in: [1, 2, 3, 4] },
                active: true,
                batch: null
              })
                .select('cardCode group name era emoji version localImagePath')
                .lean();
            } else if (eras.length) {
              pool = await Card.find({
                era: { $in: eras.map(g => new RegExp(`^${g}$`, 'i')) },
                version: { $in: [1, 2, 3, 4] },
                active: true,
                batch: null
              })
                .select('cardCode group name era emoji version localImagePath')
                .lean();
            } else if (names.length) {
              pool = await Card.find({
                $or: [
                  { name: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) } },
                  { namealias: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) } }
                ],
                version: { $in: [1, 2, 3, 4] },
                active: true,
                batch: null
              })
                .select('cardCode group name era emoji version localImagePath')
                .lean();
            }
          }
        }

        

const isPityEligible =
  (pack === 'events' || pack === 'monthlies') &&
  pity.codes?.length &&
  (pity.count >= 3 || pityTriggered);
  if (isPityEligible) {
  const isFirstCard = j === 0;

  // 🎯 FIRST CARD (80%)
  if (isFirstCard && pity.count >= 4) {
    if (Math.random() < 0.80) {
      pool = await Card.find({
        cardCode: { $in: pity.codes },
        active: true,
        batch: null
      }).lean();

      if (pool.length) {
        pityTriggered = true;
        pity.count = 0;
        pity.lastUsed = new Date();
        pityUsedThisSession = true;
      }
    }
  }

  // 🎯 ADDITIONAL CARDS (60%)
  if (!isFirstCard && pityTriggered) {
    if (Math.random() < 0.45) {
      pool = await Card.find({
        cardCode: { $in: pity.codes },
        active: true,
        batch: null
      }).lean();
    }
  }
}

        // Shared cached selective fallback
        if (!pool.length && pack === 'selective' && selectiveFallbackPool.length) {
          pool = selectiveFallbackPool;
        }
        // Shared cached events/monthlies fallback
        if (!pool.length && (pack === 'events' || pack === 'monthlies')) {
          pool = eventMonthlyV5Pool;
        }

        if (pool.length) {
          const chosen = randomFrom(pool);
          if (chosen) packCards.push(chosen);
        }
      }

      allPulled.push(packCards);

      if (pack === 'events' || pack === 'monthlies') {
        if (!pityUsedThisSession) pity.count++;
        pityUsedThisSession = false;
      }

      if ((pack === 'events' || pack === 'monthlies') && allPulled.every(packCards => packCards.length === 0)) {
        return interaction.editReply({
          content: `Currently no available cards for the **${pack}** pack.`,
          ephemeral: true
        });
      }
    }

    user.wirlies -= totalCost;
    user.keys -= totalKeys;

    if (!user.pityData) user.pityData = new Map();
    user.pityData.set(pack, pity);

    await user.save();

    const flatPulled = allPulled.flat();

    if (flatPulled.length) {
      await CardInventory.bulkWrite(
        flatPulled.map(card => ({
          updateOne: {
            filter: { userId, cardCode: card.cardCode },
            update: { $inc: { quantity: 1 } },
            upsert: true
          }
        }))
      );

      for (const card of flatPulled) {
        await emitQuestEvent(
          interaction.user.id,
          {
            type: 'shopbuy',
            card: {
              cardCode: card.cardCode,
              version: card.version,
              group: card.group,
              era: card.era,
            },
          },
          interaction
        );
      }
    }

    const pages = allPulled.map((cards, index) => {
      const desc = cards.map(c => {
        const emoji = c.emoji || generateVersion(c);
        const eraText = c.era ? `( ${c.era} )` : '';
        return `• ${emoji} **${c.group}** __${c.name}__ ${eraText} \`${c.cardCode}\``;
      }).filter(Boolean).join('\n');

      return new EmbedBuilder()
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription([
          `# Mukazo's Pack ${index + 1} / ${allPulled.length}`,
          desc || '*No cards pulled.*'
        ].filter(Boolean).join('\n'))
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

    const collector = msg.createMessageComponentCollector({ time: 120000 });

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

    await emitQuestEvent(
      interaction.user.id,
      {
        type: 'command',
        commandName: 'shopbuy',
      },
      interaction
    );
  }
};