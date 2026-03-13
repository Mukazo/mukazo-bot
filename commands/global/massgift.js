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
const { enqueueInteraction } = require('../../queue');

const MAX_VERSION_TOTAL = 1000;
const PAGE_SIZE = 5;

function parseCsv(str) {
  return (str || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseVersionInput(str) {
  if (!str) return [];

  const out = new Set();

  for (const part of str.split(',').map(s => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    const single = part.match(/^(\d+)$/);

    if (range) {
      let a = Number(range[1]);
      let b = Number(range[2]);
      if (a > b) [a, b] = [b, a];

      for (let i = a; i <= b; i++) {
        if (i >= 1 && i <= 5) out.add(i);
      }
    } else if (single) {
      const n = Number(single[1]);
      if (n >= 1 && n <= 5) out.add(n);
    }
  }

  return [...out];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massgift')
    .setDescription('Gift many cards at once using filters.')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Recipient')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Gift all copies or only duplicates')
        .setRequired(true)
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Duplicates', value: 'duplicates' }
        )
    )
    .addStringOption(o =>
      o.setName('version')
        .setDescription('Version filter, e.g. 1,2,3 or 2-5')
    )
    .addStringOption(o =>
      o.setName('group')
        .setDescription('Filter by group(s), comma-separated')
    )
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Filter by name(s), comma-separated')
    )
    .addStringOption(o =>
      o.setName('era')
        .setDescription('Filter by era(s), comma-separated')
    )
    .addStringOption(o =>
      o.setName('exclude_group')
        .setDescription('Exclude group(s), comma-separated')
    )
    .addStringOption(o =>
      o.setName('exclude_name')
        .setDescription('Exclude name(s), comma-separated')
    )
    .addStringOption(o =>
      o.setName('exclude_era')
        .setDescription('Exclude era(s), comma-separated')
    ),
    async execute(interaction) {
    const giver = interaction.user;
    const target = interaction.options.getUser('user');
    const mode = interaction.options.getString('type');

    if (!target || target.bot || target.id === giver.id) {
      return interaction.editReply({
        content: 'You can’t mass gift to yourself or to a bot.',
      });
    }

    const filters = {
      groups: parseCsv(interaction.options.getString('group')),
      names: parseCsv(interaction.options.getString('name')),
      eras: parseCsv(interaction.options.getString('era')),
      excludeGroups: parseCsv(interaction.options.getString('exclude_group')),
      excludeNames: parseCsv(interaction.options.getString('exclude_name')),
      excludeEras: parseCsv(interaction.options.getString('exclude_era')),
      versions: parseVersionInput(interaction.options.getString('version')),
    };

    const giverInventory = await CardInventory.find(
      { userId: giver.id, quantity: { $gt: 0 } },
      { _id: 0, cardCode: 1, quantity: 1 }
    ).lean();

    if (!giverInventory.length) {
      return interaction.editReply({
        content: 'You have no cards to mass gift.',
      });
    }

    const ownedCodes = giverInventory.map(i => i.cardCode);

    const cards = await Card.find(
      { cardCode: { $in: ownedCodes }, batch: null },
      {
        _id: 1,
        cardCode: 1,
        group: 1,
        name: 1,
        era: 1,
        version: 1,
        emoji: 1,
      }
    ).lean();

    const cardMap = new Map(cards.map(c => [c.cardCode, c]));

    const owned = giverInventory
      .map(entry => ({
        card: cardMap.get(entry.cardCode),
        qty: entry.quantity,
      }))
      .filter(x => !!x.card);

    const matches = owned.filter(({ card }) => {
      const group = (card.group || '').toLowerCase();
      const name = (card.name || '').toLowerCase();
      const era = (card.era || '').toLowerCase();
      const version = Number(card.version);
      if (filters.groups.length && !filters.groups.includes(group)) return false;
      if (filters.names.length && !filters.names.includes(name)) return false;
      if (filters.eras.length && !filters.eras.includes(era)) return false;

      if (filters.excludeGroups.length && filters.excludeGroups.includes(group)) return false;
      if (filters.excludeNames.length && filters.excludeNames.includes(name)) return false;
      if (filters.excludeEras.length && filters.excludeEras.includes(era)) return false;

      if (filters.versions.length && !filters.versions.includes(version)) return false;

      return true;
    });

    if (!matches.length) {
      return interaction.editReply({
        content: 'No matching cards were found in your inventory.',
      });
    }

    let totalVersionValue = 0;
    let totalCopies = 0;
    let hitCap = false;

    const gifts = [];

    for (const entry of matches) {
      const maxQty = mode === 'duplicates'
        ? Math.max(0, entry.qty - 1)
        : entry.qty;

      if (maxQty <= 0) continue;

      let giveQty = 0;
      const versionValue = Number(entry.card.version) || 0;

      for (let i = 0; i < maxQty; i++) {
        if (totalVersionValue + versionValue > MAX_VERSION_TOTAL) {
          hitCap = true;
          break;
        }

        totalVersionValue += versionValue;
        totalCopies += 1;
        giveQty += 1;
      }

      if (giveQty > 0) {
        gifts.push({
          cardCode: entry.card.cardCode,
          qty: giveQty,
        });
      }

      if (hitCap) break;
    }

    if (!gifts.length) {
      return interaction.editReply({
        content: 'No cards could be gifted under the automatic version-total limit.',
      });
    }

    const totalCodesMoved = gifts.length;

const previewDetailed = gifts
  .map(g => {
    const card = cardMap.get(g.cardCode);
    if (!card) return null;

    return {
      card,
      qty: g.qty,
    };
  })
  .filter(Boolean);

let previewPage = 0;
const previewTotalPages = Math.max(1, Math.ceil(previewDetailed.length / PAGE_SIZE));

function buildPreviewEmbed(pageIndex) {
  const slice = previewDetailed.slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE
  );

  const lines = slice.map(g => {
    const emoji = g.card.emoji || generateVersion(g.card);
    const eraText = g.card.era ? ` ( ${g.card.era} )` : '';
    return `• ${emoji} **${g.card.group}** __${g.card.name}__${eraText}\n> \`${g.card.cardCode}\` × **${g.qty}**`;
  });

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('Confirm Mass Gift?')
    .setDescription([
      `**From:** <@${giver.id}>`,
      `**To:** <@${target.id}>`,
      `**Type:** ${mode === 'duplicates' ? 'Duplicates' : 'All'}`,
      '',
      `**Unique:** ${totalCodesMoved}`,
      `**Copies:** ${totalCopies}`,
      `**Total:** ${totalVersionValue} / ${MAX_VERSION_TOTAL}`,
      hitCap ? '**Note:** The automatic version-total cap was reached.' : null,
      '',
      '### Cards to Gift',
      lines.join('\n') || 'Nothing to show.',
      '',
      'This action cannot be undone.'
    ].filter(Boolean).join('\n'))
    .setFooter({
      text: `Preview Page ${pageIndex + 1} / ${previewTotalPages}`,
    });
}

function buildPreviewRows() {
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('massgift_preview_first')
      .setLabel('First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(previewPage === 0),
    new ButtonBuilder()
      .setCustomId('massgift_preview_prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(previewPage === 0),
    new ButtonBuilder()
      .setCustomId('massgift_preview_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(previewPage >= previewTotalPages - 1),
    new ButtonBuilder()
      .setCustomId('massgift_preview_last')
      .setLabel('Last')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(previewPage >= previewTotalPages - 1)
  );

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('massgift_confirm')
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('massgift_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return previewTotalPages > 1 ? [navRow, confirmRow] : [confirmRow];
}

const previewMsg = await interaction.editReply({
  embeds: [buildPreviewEmbed(previewPage)],
  components: buildPreviewRows(),
});

    const confirmCollector = previewMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000,
    });

    let confirmed = false;

    confirmCollector.on('collect', async btn => {
  if (btn.user.id !== interaction.user.id) {
    return btn.reply({
      content: 'These buttons are not for you.',
      ephemeral: true,
    });
  }

  if (btn.customId === 'massgift_cancel') {
    confirmCollector.stop('cancelled');
    return btn.update({
      content: 'Mass gift cancelled.',
      embeds: [],
      components: [],
    });
  }

  if (btn.customId === 'massgift_preview_first') {
    previewPage = 0;
    return btn.update({
      embeds: [buildPreviewEmbed(previewPage)],
      components: buildPreviewRows(),
    });
  }

  if (btn.customId === 'massgift_preview_prev') {
    previewPage = Math.max(0, previewPage - 1);
    return btn.update({
      embeds: [buildPreviewEmbed(previewPage)],
      components: buildPreviewRows(),
    });
  }

  if (btn.customId === 'massgift_preview_next') {
    previewPage = Math.min(previewTotalPages - 1, previewPage + 1);
    return btn.update({
      embeds: [buildPreviewEmbed(previewPage)],
      components: buildPreviewRows(),
    });
  }

  if (btn.customId === 'massgift_preview_last') {
    previewPage = previewTotalPages - 1;
    return btn.update({
      embeds: [buildPreviewEmbed(previewPage)],
      components: buildPreviewRows(),
    });
  }

  if (btn.customId !== 'massgift_confirm') return;

  confirmed = true;
  confirmCollector.stop('confirmed');

  await btn.deferUpdate();

  const result = await enqueueInteraction('gift', {
    from: giver.id,
    to: target.id,
    cards: gifts,
    wirlies: 0,
    keys: 0,
    auth: false,
  });

  const workerCards = Array.isArray(result?.cards) ? result.cards : [];
  const resultMap = new Map(workerCards.map(r => [r.cardCode, r]));

  const giftedDetailed = gifts
    .map(g => {
      const card = cardMap.get(g.cardCode);
      if (!card) return null;

      const workerResult = resultMap.get(g.cardCode);

      return {
        card,
        qty: workerResult?.qty ?? g.qty,
        total: workerResult?.total ?? null,
      };
    })
    .filter(Boolean);

  if (!giftedDetailed.length) {
    return interaction.editReply({
      content: 'Mass gift completed, but no gift summary could be built.',
      embeds: [],
      components: [],
    });
  }
  let page = 0;
  const totalPages = Math.max(1, Math.ceil(giftedDetailed.length / PAGE_SIZE));

  function buildEmbed(pageIndex) {
    const slice = giftedDetailed.slice(
      pageIndex * PAGE_SIZE,
      pageIndex * PAGE_SIZE + PAGE_SIZE
    );

    const lines = slice.map(g => {
      const emoji = g.card.emoji || generateVersion(g.card);
      const eraText = g.card.era ? ` ( ${g.card.era} )` : '';
      return `• ${emoji} **${g.card.group}** __${g.card.name}__${eraText}\n> \`${g.card.cardCode}\` × **${g.qty}**${g.total != null ? ` [Copies: ${g.total}]` : ''}`;
    });

    return new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTitle(`┈  Mass Gift to ${target.username}  ┈`)
      .setDescription(lines.join('\n') || 'Nothing to show.')
      .addFields(
        { name: 'Unique', value: `${giftedDetailed.length}`, inline: true },
        { name: 'Copies', value: `${totalCopies}`, inline: true },
        { name: 'Total', value: `${totalVersionValue} / ${MAX_VERSION_TOTAL}`, inline: true }
      )
      .setFooter({
        text: `Page ${pageIndex + 1} / ${totalPages}${hitCap ? ' • Hit automatic cap' : ''}`,
      });
  }

  function buildRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('massgift:first')
        .setLabel('First')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('massgift:prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('massgift:next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId('massgift:last')
        .setLabel('Last')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
  }

  const resultMsg = await interaction.editReply({
    content: null,
    embeds: [buildEmbed(page)],
    components: totalPages > 1 ? [buildRow()] : [],
  });

  await interaction.followUp({
    content: `Mass gift sent to <@${target.id}>!`,
    allowedMentions: { users: [target.id] },
  });

  if (totalPages <= 1) return;

  const pageCollector = resultMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000,
  });

  pageCollector.on('collect', async pageBtn => {
    if (pageBtn.user.id !== interaction.user.id) {
      return pageBtn.reply({
        content: 'These buttons are not for you.',
        ephemeral: true,
      });
    }

    await pageBtn.deferUpdate();

    if (pageBtn.customId === 'massgift:first') page = 0;
    if (pageBtn.customId === 'massgift:prev') page = Math.max(0, page - 1);
    if (pageBtn.customId === 'massgift:next') page = Math.min(totalPages - 1, page + 1);
    if (pageBtn.customId === 'massgift:last') page = totalPages - 1;

    await interaction.editReply({
      embeds: [buildEmbed(page)],
      components: [buildRow()],
    }).catch(() => {});
  });

  pageCollector.on('end', async () => {
    await interaction.editReply({
      components: [],
    }).catch(() => {});
  });
});
  },
};