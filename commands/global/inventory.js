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

const PAGE_SIZE = 10;

/* ===========================
   CUSTOM COMPARISON EMOJIS
=========================== */
const THEY_HAVE_EMOJI = ':hibiscus: '; // they have, you don't
const YOU_HAVE_EMOJI  = ':fairy: ';  // you have, they don't

const VERSION_ORDER = {
  v5: 5,
  v4: 4,
  v3: 3,
  v2: 2,
  v1: 1,
};

function normalize(str) {
  return str?.toLowerCase();
}

function parseList(str) {
  return (str || '')
    .split(',')
    .map(v => normalize(v.trim()))
    .filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View card inventories.')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('View another user’s inventory')
    )
    .addStringOption(o =>
      o.setName('show')
        .setRequired(true)
        .addChoices(
          { name: 'Owned', value: 'owned' },
          { name: 'Missing', value: 'missing' },
          { name: 'Duplicates', value: 'duplicates' }
        )
    )
    .addStringOption(o => o.setName('group'))
    .addStringOption(o => o.setName('era'))
    .addStringOption(o => o.setName('category'))
    .addStringOption(o => o.setName('version'))
    .addStringOption(o => o.setName('name')),

  async execute(interaction) {
    await interaction.deferReply();

    const viewerId = interaction.user.id;
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const targetId = targetUser.id;

    const show = interaction.options.getString('show');

    const groups = parseList(interaction.options.getString('group'));
    const eras = parseList(interaction.options.getString('era'));
    const categories = parseList(interaction.options.getString('category'));
    const versions = parseList(interaction.options.getString('version'));
    const names = parseList(interaction.options.getString('name'));

    const [cards, viewerInv, targetInv] = await Promise.all([
      Card.find({}).lean(),
      CardInventory.find({ userId: viewerId }).lean(),
      CardInventory.find({ userId: targetId }).lean(),
    ]);

    const viewerMap = new Map(viewerInv.map(i => [i.cardCode, i.quantity]));
    const targetMap = new Map(targetInv.map(i => [i.cardCode, i.quantity]));

    let results = cards.filter(card => {
      const viewerQty = viewerMap.get(card.cardCode) || 0;
      const targetQty = targetMap.get(card.cardCode) || 0;

      if (show === 'owned' && targetQty <= 0) return false;
      if (show === 'missing' && targetQty > 0) return false;
      if (show === 'duplicates' && targetQty <= 1) return false;

      if (groups.length && !groups.includes(normalize(card.group))) return false;
      if (eras.length && !eras.includes(normalize(card.era))) return false;
      if (categories.length && !categories.includes(normalize(card.category))) return false;
      if (versions.length && !versions.includes(normalize(card.version))) return false;

      if (names.length) {
        const name = normalize(card.name);
        const alias = normalize(card.nameAlias);
        if (!names.some(n => name?.includes(n) || alias?.includes(n))) {
          return false;
        }
      }

      return true;
    });

    results.sort((a, b) => {
      const v =
        (VERSION_ORDER[b.version] || 0) -
        (VERSION_ORDER[a.version] || 0);
      if (v !== 0) return v;

      const d = new Date(a.createdAt) - new Date(b.createdAt);
      if (d !== 0) return d;

      const g = a.group.localeCompare(b.group);
      if (g !== 0) return g;

      return a.name.localeCompare(b.name);
    });

    if (!results.length) {
      return interaction.editReply('No cards matched your filters.');
    }

    let page = 0;

    const getEmbed = () => {
      const slice = results.slice(
        page * PAGE_SIZE,
        page * PAGE_SIZE + PAGE_SIZE
      );

      const description = slice.map(card => {
        const viewerQty = viewerMap.get(card.cardCode) || 0;
        const targetQty = targetMap.get(card.cardCode) || 0;

        let compareEmoji = '';
        if (viewerId !== targetId) {
          if (targetQty > 0 && viewerQty === 0) compareEmoji = THEY_HAVE_EMOJI;
          else if (viewerQty > 0 && targetQty === 0) compareEmoji = YOU_HAVE_EMOJI;
        }

        const emoji = card.overrideemoji || generateVersion(card);

        return [
          `${compareEmoji} ${emoji} **${card.group}**`.trim(),
          `**${card.name}**`,
          card.era ? `*${card.era}*` : null,
          `\`${card.cardCode}\` ×${targetQty}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n');

      return new EmbedBuilder()
        .setTitle(
          viewerId === targetId
            ? `${interaction.user.username}'s Inventory`
            : `${targetUser.username}'s Inventory`
        )
        .setDescription(description)
        .setFooter({
          text: `Page ${page + 1} / ${Math.ceil(results.length / PAGE_SIZE)}`,
        });
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('copy')
        .setLabel('Copy Codes')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary),
    );

    const message = await interaction.editReply({
      embeds: [getEmbed()],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'prev') {
        page = Math.max(0, page - 1);
      }

      if (btn.customId === 'next') {
        page = Math.min(
          Math.ceil(results.length / PAGE_SIZE) - 1,
          page + 1
        );
      }

      if (btn.customId === 'copy') {
        const slice = results.slice(
          page * PAGE_SIZE,
          page * PAGE_SIZE + PAGE_SIZE
        );

        const codes = slice.map(c => c.cardCode).join(', ');

        return btn.followUp({
          content: codes || 'No cards on this page.',
          ephemeral: true,
        });
      }

      await message.edit({ embeds: [getEmbed()] });
    });

    collector.on('end', async () => {
      row.components.forEach(b => b.setDisabled(true));
      await message.edit({ components: [row] });
    });
  },
};
