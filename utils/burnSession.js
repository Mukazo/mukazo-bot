const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const CardInventory = require('../models/CardInventory');
const Card = require('../models/Card');
const generateVersion = require('./utils/generateVersion');

const PAGE_SIZE = 6;
const V_WIRLIES = { V1: 10, V2: 20, V3: 30, V4: 40 };

function toList(str) {
  return str?.split(',').map(x => x.trim()).filter(Boolean) || [];
}

function formatBurnLine(card, qty) {
  const eraText = card.era ? ` ( ${card.era} )` : '';
  const emoji = card.emoji || generateVersion(card);
  return `${emoji} **${card.group}** __${card.name}__ ${eraText}\n × **${qty}** ✮ \`${card.cardCode}\``;
}

function calculateBurnRewards(cards) {
  let totalWirlies = 0;
  let totalKeys = 0;

  for (const card of cards) {
    const qty = card.qty || 0;
    const versionKey = `V${card.version}`;

    if ([1, 2, 3, 4].includes(card.version)) {
      totalWirlies += (V_WIRLIES[versionKey] || 0) * qty;
    } else if (card.version === 5) {
      totalKeys += Math.floor(qty / 2);
      totalWirlies += (qty % 2) * 1000;
    }
  }

  return { totalWirlies, totalKeys };
}
module.exports = async function burnSession(interaction) {

  const userId = interaction.user.id;

  const group = toList(interaction.options.getString('group')).map(x => x.toLowerCase());
  const name = toList(interaction.options.getString('name')).map(x => x.toLowerCase());
  const era = toList(interaction.options.getString('era')).map(x => x.toLowerCase());
  const version = toList(interaction.options.getString('version')).map(x => parseInt(x));
  const excludeName = toList(interaction.options.getString('exclude_name')).map(x => x.toLowerCase());
  const excludeEra = toList(interaction.options.getString('exclude_era')).map(x => x.toLowerCase());
  const excludeV5 = interaction.options.getBoolean('exclude_v5') === true;

  const inventory = await CardInventory.find({ userId }).lean();
  const cardCodes = inventory.map(c => c.cardCode);
  const cards = await Card.find({ cardCode: { $in: cardCodes } }).lean();

  const matched = cards
    .filter(card => {
      const g = (card.group || '').toLowerCase();
      const n = (card.name || '').toLowerCase();
      const e = (card.era || '').toLowerCase();
      const v = Number(card.version);

      if (excludeV5 && v === 5) return false;
      if (group.length && !group.includes(g)) return false;
      if (name.length && !name.includes(n)) return false;
      if (era.length && !era.includes(e)) return false;
      if (version.length && !version.includes(v)) return false;
      if (excludeName.length && excludeName.includes(n)) return false;
      if (excludeEra.length && excludeEra.includes(e)) return false;

      return true;
    })
    .map(card => {
      const inv = inventory.find(i => i.cardCode === card.cardCode);
      return { ...card, qty: inv?.quantity || 0 };
    })
    .filter(c => c.qty > 0);

  if (!matched.length) {
    return interaction.editReply('No matching cards found in your inventory.');
  }

  const { totalWirlies, totalKeys } = calculateBurnRewards(matched);

  const page = 0;
  const pageCards = matched.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setDescription([
        '## Burn Preview',
      pageCards.map(c => formatBurnLine(c, c.qty)).join('\n') +
      `\n\n**Total <:Wirlies:1455924065972785375> Wirlies:** ${totalWirlies.toLocaleString()}\n**Total <:Key:1456059698582392852> Keys:** ${totalKeys.toLocaleString()}`
    ].filter(Boolean).join('\n'))
    .setFooter({ text: `Page ${page + 1} / ${Math.ceil(matched.length / PAGE_SIZE)}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`burn:page:${page - 1}`).setLabel(' • Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`burn:confirm`).setLabel('Confirm • Burn').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`burn:cancel`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`burn:page:${page + 1}`).setLabel('Next • ').setStyle(ButtonStyle.Secondary)
      .setDisabled((page + 1) * PAGE_SIZE >= matched.length)
  );

  interaction.client.burnSessions ??= new Map();
  interaction.client.burnSessions.set(userId, matched);

  return interaction.editReply({ embeds: [embed], components: [row] });
};