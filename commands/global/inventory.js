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
const User = require('../../models/User');

const PAGE_SIZE = 8;

const THEY_HAVE_EMOJI = ':hibiscus:';
const YOU_HAVE_EMOJI  = ':fairy:';

function normalize(value) {
  if (typeof value !== 'string') return '';
  return value.toLowerCase();
}

function parseList(str) {
  if (typeof str !== 'string') return [];
  return str
    .split(',')
    .map(v => normalize(v.trim()))
    .filter(Boolean);
}

// ✅ versions are numeric in DB; parse input into [Number]
function parseNumberList(str) {
  if (typeof str !== 'string') return [];
  return str
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => Number(v))
    .filter(n => Number.isFinite(n));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View inventories.')
    .addStringOption(o =>
      o.setName('view')
        .setDescription('options')
        .setRequired(true)
        .addChoices(
          { name: 'Owned Cards', value: 'owned' },
          { name: 'Duplicate Cards', value: 'duplicates' },
          { name: 'Missing Cards', value: 'missing' },
        )
    )
    .addUserOption(o =>
      o.setName('user')
        .setDescription('View another user’s inventory')
    )
    .addStringOption(o => o.setName('group').setDescription('Filter by group'))
    .addStringOption(o => o.setName('era').setDescription('Filter by era'))
    .addStringOption(o => o.setName('category').setDescription('Filter by category'))
    // ✅ clarify numeric usage
    .addStringOption(o => o.setName('version').setDescription('Filter by version numbers (e.g. 1,2,3 or 2,4,5)'))
    .addStringOption(o => o.setName('name').setDescription('Filter by name')),

  async execute(interaction) {
    // No deferReply here because your index.js already handles it

    const viewerId = interaction.user.id;
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const targetId = targetUser.id;
    const view = interaction.options.getString('view');

    const groups = parseList(interaction.options.getString('group'));
    const eras = parseList(interaction.options.getString('era'));
    const categories = parseList(interaction.options.getString('category'));
    const versions = parseNumberList(interaction.options.getString('version')); // ✅ numeric list
    const names = parseList(interaction.options.getString('name'));

    const [cards, viewerInv, targetInv] = await Promise.all([
      Card.find({}).lean(),
      CardInventory.find({ userId: viewerId }).lean(),
      CardInventory.find({ userId: targetId }).lean(),
    ]);

    const [viewerUserDoc, targetUserDoc] = await Promise.all([
  User.findOne({ userId: viewerId }).lean(),
  viewerId === targetId ? null : User.findOne({ userId: targetId }).lean(),
]);

const viewerBalance = viewerUserDoc?.wirlies ?? 0;
const targetBalance = targetUserDoc?.wirlies ?? viewerBalance;
const viewerKeys = viewerUserDoc?.keys ?? 0;
const targetKeys = targetUserDoc?.keys ?? viewerKeys;


    const viewerMap = new Map(viewerInv.map(i => [i.cardCode, i.quantity]));
    const targetMap = new Map(targetInv.map(i => [i.cardCode, i.quantity]));

    let results = cards.filter(card => {
      if (card.batch != null) return false;

      const viewerQty = viewerMap.get(card.cardCode) || 0;
      const targetQty = targetMap.get(card.cardCode) || 0;

      if (view === 'owned' && targetQty <= 0) return false;
      if (view === 'missing' && targetQty > 0) return false;
      if (view === 'duplicates' && targetQty <= 1) return false;

      if (groups.length && !groups.includes(normalize(card.group))) return false;
      if (eras.length && !eras.includes(normalize(card.era))) return false;
      if (categories.length && !categories.includes(normalize(card.category))) return false;

      // ✅ numeric compare against numeric list
      if (versions.length) {
        const v = Number(card.version);
        if (!Number.isFinite(v)) return false;
        if (!versions.includes(v)) return false;
      }

      if (names.length) {
        const name = normalize(card.name);
        const alias = normalize(card.namealias); // ✅ your field name
        if (!names.some(n => name.includes(n) || alias.includes(n))) return false;
      }

      return true;
    });

    const defaultSort = () => {
      results.sort((a, b) => {
        // ✅ Version: highest first (5→1) because it's numeric
        if (Number.isFinite(b.version) && Number.isFinite(a.version) && b.version !== a.version) {
          return b.version - a.version;
        }
        // If version missing, push missing versions lower
        if (Number.isFinite(b.version) && !Number.isFinite(a.version)) return -1;
        if (!Number.isFinite(b.version) && Number.isFinite(a.version)) return 1;

        // You said you don't want date sorting, so we skip it.

        const gDiff = a.group.localeCompare(b.group);
        if (gDiff !== 0) return gDiff;

        return a.name.localeCompare(b.name);
      });
    };

    defaultSort();

    if (!results.length) {
      return interaction.editReply('No cards matched your filters.');
    }

    let page = 0;
    let sortMode = 'default'; // 'default' | 'copies'

    const getEmbed = () => {
      const slice = results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      const description = slice.map(card => {
        const viewerQty = viewerMap.get(card.cardCode) || 0;
        const targetQty = targetMap.get(card.cardCode) || 0;

        let compareEmoji = '';
        if (viewerId !== targetId) {
          if (targetQty > 0 && viewerQty === 0) compareEmoji = THEY_HAVE_EMOJI;
          else if (viewerQty > 0 && targetQty === 0) compareEmoji = YOU_HAVE_EMOJI;
        }

        const emoji = card.emoji || generateVersion(card);
        const eraText = card.era ? ` ( ${card.era} )` : '';

        // ❗ layout unchanged (keeps newline exactly as you had)
        return `-# ${emoji} ${card.group} **${card.name}**${eraText} \`${card.cardCode}\` × **${targetQty}** ${compareEmoji}`.trim();
      }).join('\n');

      return new EmbedBuilder()
        .setDescription([
            viewerId === targetId
            ? `# ${interaction.user.username}'s Inventory`
            : `# ${targetUser.username}'s Inventory`,
            viewerId === targetId
            ? `**Balance: <:Wirlies:1455924065972785375> ${viewerBalance.toLocaleString()} &  🗝️ ${viewerKeys.toLocaleString()}**`
            : `**Balance: <:Wirlies:1455924065972785375> ${targetBalance.toLocaleString()} &  🗝️ ${targetKeys.toLocaleString()}**`,
            '> When viewing another user\'s inventory, the following means:',
            '-# :hibiscus: = You do not own, they do | :fairy: = You do own, they do not',
            '',
            description || ' '
        ].join('\n'))
        .setFooter({
          text: `Page ${page + 1} / ${Math.max(1, Math.ceil(results.length / PAGE_SIZE))}`,
        });
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel(' • Previous').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('copy').setLabel('Copy • Codes').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sort_copies').setLabel('Sort • Copies').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('Next • ').setStyle(ButtonStyle.Secondary),
    );

    const message = await interaction.editReply({
      embeds: [getEmbed()],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 240_000,
    });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'prev') {
        page = Math.max(0, page - 1);
      }

      if (btn.customId === 'next') {
        page = Math.min(Math.ceil(results.length / PAGE_SIZE) - 1, page + 1);
      }

      if (btn.customId === 'sort_copies') {
        sortMode = sortMode === 'copies' ? 'default' : 'copies';

        if (sortMode === 'copies') {
          results.sort((a, b) => {
            const qa = targetMap.get(a.cardCode) || 0;
            const qb = targetMap.get(b.cardCode) || 0;
            // Highest copies first; tie-breaker keep your existing default ordering
            if (qb !== qa) return qb - qa;

            // Tie-breaker: version desc, then group, then name
            if (Number.isFinite(b.version) && Number.isFinite(a.version) && b.version !== a.version) {
              return b.version - a.version;
            }
            const gDiff = a.group.localeCompare(b.group);
            if (gDiff !== 0) return gDiff;
            return a.name.localeCompare(b.name);
          });
        } else {
          defaultSort();
        }

        page = 0;
      }

      if (btn.customId === 'copy') {
        const slice = results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        const codes = slice.map(c => c.cardCode).join(', ');
        return btn.followUp({ content: codes || 'No cards on this page.', ephemeral: true });
      }

      await message.edit({ embeds: [getEmbed()] });
    });

    collector.on('end', async () => {
      row.components.forEach(b => b.setDisabled(true));
      await message.edit({ components: [row] });
    });
  },
};
