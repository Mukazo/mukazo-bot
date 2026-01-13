const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const CardInventory = require('../../models/CardInventory');
const User = require('../../models/User');
const generateVersion = require('../../utils/generateVersion');

const PAGE_SIZE = 6;
const V_WIRLIES = { V1: 10, V2: 20, V3: 30, V4: 40 };

function formatBurnLine(card, qty) {
  const emoji = card.emoji || generateVersion(card);
  return `${emoji} **${card.group}** __${card.name}__ \n × **${qty}** ✮ \`${card.cardCode}\``;
}

module.exports = async function handleBurnButton(interaction) {
  if (!interaction.customId.startsWith('burn:')) return;

  await interaction.deferUpdate();

  const [_, action, rawPage] = interaction.customId.split(':');
  const userId = interaction.user.id;
  const session = interaction.client.burnSessions?.get(userId);
  if (!session) return;

  let page = parseInt(rawPage || '0', 10);

  if (action === 'cancel') {
    interaction.client.burnSessions.delete(userId);
    return interaction.editReply({ content: 'Burn cancelled.', components: [], embeds: [] });
  }

  if (action === 'confirm') {
    let totalWirlies = 0;
    let totalKeys = 0;

    for (const card of session) {
      const qty = card.qty;
      if (['V1', 'V2', 'V3', 'V4'].includes(card.version)) {
        const value = V_WIRLIES[card.version] * qty;
        totalWirlies += value;
      } else if (card.version === 'V5') {
        const keys = Math.floor(qty / 2);
        const leftover = qty % 2;
        totalKeys += keys;
        totalWirlies += leftover * 1000;
      }

      await CardInventory.updateOne(
        { userId, cardCode: card.cardCode },
        { $inc: { quantity: -qty } }
      );
      await CardInventory.deleteOne({ userId, cardCode: card.cardCode, quantity: { $lte: 0 } });
    }

    await User.updateOne(
      { userId },
      { $inc: { wirlies: totalWirlies, keys: totalKeys } },
      { upsert: true }
    );

    interaction.client.burnSessions.delete(userId);

    const embed = new EmbedBuilder()
      .setDescription([
        '## Burn Complete',
        session.map(c => formatBurnLine(c, c.qty))].filter(Boolean).join('\n'))
      .addFields(
        { name: 'Wirlies', value: `+ <:Wirlies:1455924065972785375> ${totalWirlies.toLocaleString()}`, inline: true },
        { name: 'Keys', value: `+ <:Key:1456059698582392852> ${totalKeys.toLocaleString()}`, inline: true }
      );

    return interaction.editReply({ embeds: [embed], components: [] });
  }

  const pageCards = session.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setDescription([
        '## Burn Summary',
        pageCards.map(c => formatBurnLine(c, c.qty)).join('\n')
        `\n\n**Total <:Wirlies:1455924065972785375> Wirlies:** ${totalWirlies.toLocaleString()}\n**Total <:Key:1456059698582392852> Keys:** ${totalKeys.toLocaleString()}`
    ].filter(Boolean).join('\n'))
        
    .setFooter({ text: `Page ${page + 1} / ${Math.ceil(session.length / PAGE_SIZE)}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`burn:page:${page - 1}`)
      .setLabel('• Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`burn:confirm`)
      .setLabel('Confirm • Burn')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`burn:cancel`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`burn:page:${page + 1}`)
      .setLabel('Next • ')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((page + 1) * PAGE_SIZE >= session.length)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
};