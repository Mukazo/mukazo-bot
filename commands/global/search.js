const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
} = require('discord.js');

const { createCanvas, loadImage } = require('canvas');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const generateVersion = require('../../utils/generateVersion');

const PAGE_SIZE = 1;
const CARD_WIDTH = 320;
const CARD_HEIGHT = 480;

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
    const focused = interaction.options.getFocused(true);
    const value = focused.value.toLowerCase();

    const cards = await Card.find({}).lean();
    let choices = [];

    if (focused.name === 'name') {
      choices = [
        ...new Set(
          cards.flatMap(c => [c.name, c.namealias]).filter(Boolean)
        ),
      ];
    }
    if (focused.name === 'group') {
      choices = [...new Set(cards.map(c => c.group).filter(Boolean))];
    }
    if (focused.name === 'era') {
      choices = [...new Set(cards.map(c => c.era).filter(Boolean))];
    }
    if (focused.name === 'category') {
      choices = [
        ...new Set(
          cards.flatMap(c => [c.category, c.categoryalias]).filter(Boolean)
        ),
      ];
    }

    await interaction.respond(
      choices
        .filter(c => c.toLowerCase().includes(value))
        .slice(0, 25)
        .map(c => ({ name: c, value: c }))
    );
  },

  /* ===========================
     EXECUTE
  =========================== */
  async execute(interaction) {
    const userId = interaction.user.id;

    const name = interaction.options.getString('name');
    const group = interaction.options.getString('group');
    const era = interaction.options.getString('era');
    const category = interaction.options.getString('category');
    const version = interaction.options.getInteger('version');

    const [cards, inventory] = await Promise.all([
      Card.find({}).lean(),
      CardInventory.find({ userId }).lean(),
    ]);

    const ownedMap = new Map(inventory.map(i => [i.cardCode, i.quantity]));

    let results = cards.filter(card => {
      if (card.batch != null) return false;

      if (name) {
        const q = name.toLowerCase();
        const n = card.name?.toLowerCase() ?? '';
        const a = card.namealias?.toLowerCase() ?? '';
        if (!n.includes(q) && !a.includes(q)) return false;
      }

      if (group && card.group !== group) return false;
      if (era && card.era !== era) return false;
      if (category) {
        const q = category.toLowerCase();
        const n = card.category?.toLowerCase() ?? '';
        const a = card.categoryalias?.toLowerCase() ?? '';
        if (!n.includes(q) && !a.includes(q)) return false;
      }
      if (version && card.version !== version) return false;

      return true;
    });

    if (!results.length) {
      return interaction.editReply({ content: 'No cards found.' });
    }

    let page = 0;

    const renderPage = async () => {
      const slice = results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
      const card = slice[0]; // since PAGE_SIZE = 1
      const imageSource = card.localImagePath ? `attachment://${card._id}.png`
        : (card.discordPermalinkImage || card.imgurImageLink);
    const files = card.localImagePath ? [{ attachment: card.localImagePath, name: `${card._id}.png` }] : [];


      const embed = new EmbedBuilder()
        .setDescription('## Searching for . . .\n> Here you can view & find all Mukazo\'s cards information!')
        .setImage(imageSource)
        .setFooter({
          text: `Page ${page + 1} / ${Math.ceil(results.length / PAGE_SIZE)}`,
        });

      slice.forEach(card => {
        const copies = ownedMap.get(card.cardCode) || 0;

embed.addFields({
  name: `${card.emoji || generateVersion(card)} ${card.name}`,
  value: [
  `**Group:** ${card.group}`,
  card.era ? `**Era:** ${card.era}` : null,

  card.designerIds?.length
    ? `> **Designers:** ${card.designerIds.map(id => `<@${id}>`).join(', ')}`
    : null,

  `> **Code:** \`${card.cardCode}\``,
  `> **Copies:** ${ownedMap.get(card.cardCode) ?? 0}`,
].filter(Boolean).join('\n'),
  inline: true,
});
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
      files: [files],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 240_000,
    });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'prev') page = Math.max(0, page - 1);
      if (btn.customId === 'next') page = Math.min(Math.ceil(results.length / PAGE_SIZE) - 1, page + 1);

      const { embed } = await renderPage();
      await message.edit({ embeds: [embed], files: [files] });
    });

    collector.on('end', async () => {
      row.components.forEach(b => b.setDisabled(true));
      await message.edit({ components: [row] });
    });
  },
};