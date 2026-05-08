const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const generateVersion = require('../../utils/generateVersion');

const PAGE_SIZE = 1;

function parseMulti(input) {
  if (!input) return null;

  const trimmed = input.trim();

  // detect parentheses
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

function parseAndEscape(input) {
  if (typeof input !== 'string') return [];

  const trimmed = input.trim();

  const values = (() => {
    const match = trimmed.match(/^\((.+)\)$/);
    if (match) {
      return match[1]
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    }
    return [trimmed];
  })();

  return values.map(v => {
    const normalized = normalize(v);
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped;
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search all cards.')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Search by card name or alias')
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('group')
        .setDescription('Filter by group')
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('era')
        .setDescription('Filter by era')
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('category')
        .setDescription('Filter by category')
        .setAutocomplete(true)
    )
    .addIntegerOption(o =>
      o.setName('version')
        .setDescription('Filter by version')
        .addChoices(
          { name: 'Version 5', value: 5 },
          { name: 'Version 4', value: 4 },
          { name: 'Version 3', value: 3 },
          { name: 'Version 2', value: 2 },
          { name: 'Version 1', value: 1 },
        )
    ),

    

  /* ===========================
     AUTOCOMPLETE
  =========================== */
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const value = String(focused.value || '').toLowerCase().trim();

      let choices = [];

      if (focused.name === 'category') {
        choices = [
          'Specials',
          'Video Games',
          'Entertainment',
          'Animanga',
          'Other Music',
          'Music',
          'Asia Media',
        ];
      } else if (focused.name === 'group') {
        const groups = await Card.distinct('group', { batch: null });
        choices = groups.filter(Boolean);
      } else if (focused.name === 'era') {
        const eras = await Card.distinct('era', { batch: null });
        choices = eras.filter(Boolean);
      } else if (focused.name === 'name') {
        const [names, aliases] = await Promise.all([
          Card.distinct('name', { batch: null }),
          Card.distinct('namealias', { batch: null }),
        ]);

        choices = [...new Set([...names, ...aliases].filter(Boolean))];
      }

      const filtered = choices
        .filter(c => c.toLowerCase().includes(value))
        .slice(0, 25)
        .map(c => ({ name: c, value: c }));

      await interaction.respond(filtered);
    } catch (error) {
      console.error('Autocomplete error:', error);

      if (!interaction.responded) {
        try {
          await interaction.respond([]);
        } catch {}
      }
    }
  },



  /* ===========================
     EXECUTE
  =========================== */
  async execute(interaction) {
    function parseMulti(input) {
  if (!input) return null;

  const trimmed = input.trim();

  // detect parentheses
  const match = trimmed.match(/^\((.+)\)$/);

  if (match) {
    return match[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  return [trimmed];
}
    const userId = interaction.user.id;

    const name = interaction.options.getString('name');
    const group = interaction.options.getString('group');
    const era = interaction.options.getString('era');
    const category = interaction.options.getString('category');
    const version = interaction.options.getInteger('version');

    const cardQuery = {
      batch: null,
    };

    if (name) {
  const names = parseAndEscape(name);

  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: names.flatMap(n => ([
      { name: new RegExp(`^${n}$`, 'i') },
      { namealias: new RegExp(`^${n}$`, 'i') },
    ]))
  });
}

if (group) {
  const groups = parseAndEscape(group);

  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: groups.flatMap(g => ([
      { group: new RegExp(`^${g}$`, 'i') },
      { groupalias: new RegExp(`^${g}$`, 'i') },
    ]))
  });
}

    if (era) {
  const eras = parseAndEscape(era);

  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: eras.map(e => ({
      era: new RegExp(`^${e}$`, 'i')
    }))
  });
}

    if (category) {
      const categoryRegex = new RegExp(`^${category}$`, 'i');

      if (cardQuery.$and) {
        cardQuery.$and.push({
          $or: [
            { category: categoryRegex },
            { categoryalias: categoryRegex },
          ]
        });
      } else {
        cardQuery.$and = [
          {
            $or: [
              { category: categoryRegex },
              { categoryalias: categoryRegex },
            ]
          }
        ];
      }
    }

    if (version) {
      cardQuery.version = version;
    }

    const [results, inventory] = await Promise.all([
      Card.find(cardQuery)
        .select('cardCode group name era emoji version localImagePath designerIds discordPermalinkImage imgurImageLink category categoryalias namealias')
        .lean(),
      CardInventory.find({ userId })
        .select('cardCode quantity')
        .lean(),
    ]);
    const ownedMap = new Map(inventory.map(i => [i.cardCode, i.quantity]));

    results.sort((a, b) => {
      const verA = Number(a.version) || 0;
      const verB = Number(b.version) || 0;

      if (verA !== verB) return verB - verA;

      const groupA = a.group || '';
      const groupB = b.group || '';
      const groupDiff = groupA.localeCompare(groupB);
      if (groupDiff !== 0) return groupDiff;

      return (a.name || '').localeCompare(b.name || '');
    });

    if (!results.length) {
      return interaction.editReply({ content: 'No cards found.' });
    }

    let page = 0;

    const renderPage = async () => {
      const card = results[page];
      const copies = ownedMap.get(card.cardCode) || 0;

      const fileName = `${card._id}.png`;
      const imageSource = card.localImagePath
        ? `attachment://${fileName}`
        : (card.discordPermalinkImage || card.imgurImageLink);

      const files = card.localImagePath
        ? [{ attachment: card.localImagePath, name: fileName }]
        : [];

      const embed = new EmbedBuilder()
        .setDescription('## Searching for . . .\n> Here you can view & find all \n> Mukazo\'s cards information!')
        .setImage(imageSource)
        .setFooter({
          text: `Page ${page + 1} / ${results.length}`,
        })
        .addFields({
          name: `${card.emoji || generateVersion(card)} ${card.name}`,
          value: [
            `**Group:** ${card.group}`,
            card.era ? `**Era:** ${card.era}` : null,
            card.designerIds?.length
              ? `> **Designers:** ${card.designerIds.map(id => `<@${id}>`).join(', ')}`
              : null,
            `> **Code:** \`${card.cardCode}\``,
            `> **Copies:** ${copies}`,
          ].filter(Boolean).join('\n'),
          inline: false,
        });

      return { embed, files };
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel(' • Previous').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('Next • ').setStyle(ButtonStyle.Secondary),
    );

    const { embed, files } = await renderPage();

    const message = await interaction.editReply({
      embeds: [embed],
      files,
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000,
    });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'prev') page = Math.max(0, page - 1);
      if (btn.customId === 'next') page = Math.min(results.length - 1, page + 1);

      row.components[0].setDisabled(page === 0);
      row.components[1].setDisabled(page === results.length - 1);

      const { embed, files } = await renderPage();
      await message.edit({
        embeds: [embed],
        files,
        components: [row],
      }).catch(() => {});
    });

    collector.on('end', async () => {
      row.components.forEach(b => b.setDisabled(true));

      const { embed, files } = await renderPage();
      await message.edit({
        embeds: [embed],
        files,
        components: [row],
      }).catch(() => {});
    });
  },
};