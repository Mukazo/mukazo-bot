// commands/guild-only/authgift.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

const Card = require('../../models/Card');
const GiftSession = require('../../models/GiftSession');
const generateVersion = require('../../utils/generateVersion');

const PAGE_SIZE = 3;

function parseCardCodes(input) {
  return input
    .split(',')
    .map(p => p.trim())
    .map(part => {
      const match = part.match(/^(.+?)(?:=\+(\d+))?$/);
      if (!match) return null;
      return {
        cardCode: match[1],
        qty: match[2] ? Number(match[2]) : 1,
      };
    })
    .filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('authgift')
    .setDescription('Authorize a gift (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .addUserOption(o =>
      o.setName('user').setDescription('Recipient').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('cardcode').setDescription('CARDCODE or CARDCODE=+N')
    )
    .addIntegerOption(o =>
      o.setName('wirlies').setDescription('Wirlies to grant')
    )
    .addIntegerOption(o =>
      o.setName('keys').setDescription('Keys to grant')
    ),

  async execute(interaction) {
    const senderId = interaction.user.id;
    const target = interaction.options.getUser('user');
    const cardcodeRaw = interaction.options.getString('cardcode');
    const wirlies = interaction.options.getInteger('wirlies') ?? 0;
    const keys = interaction.options.getInteger('keys') ?? 0;

    if (!cardcodeRaw && wirlies <= 0 && keys <= 0) {
      return interaction.editReply({ content: 'Nothing to gift.' });
    }

    const parsed = cardcodeRaw ? parseCardCodes(cardcodeRaw) : [];
    const cards = parsed.length
      ? await Card.find({ cardCode: { $in: parsed.map(p => p.cardCode) } })
      : [];

    const cardMap = new Map(cards.map(c => [c.cardCode, c]));
    const results = [];

    for (const { cardCode, qty } of parsed) {
      const card = cardMap.get(cardCode);
      if (!card) {
        return interaction.editReply({ content: `Card not found: ${cardCode}` });
      }
      results.push({ card, qty });
    }

    const session = await GiftSession.create({
      userId: senderId,
      targetId: target.id,
      cards: results.map(r => ({
        cardCode: r.card.cardCode,
        qty: r.qty,
      })),
      wirlies,
      keys,
      auth: true, // 🔑
    });

    const pageResults = results.slice(0, PAGE_SIZE);

    const description =
  pageResults.length > 0
    ? pageResults
        .map(r => {
          const emoji = r.card.emoji || generateVersion(r.card);
          return (
            `${emoji} **${r.card.group}**` +
            `${r.card.name}\n` +
            `\`${r.card.cardCode}\` × **${r.qty}**`
          );
        })
        .join('\n\n')
    : [
        wirlies > 0 ? `# + <:Wirlies:1455924065972785375> ${wirlies}` : null,
        keys > 0 ? `# + <:Key:1456059698582392852> ${keys}` : null,
      ]
        .filter(Boolean)
        .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Confirm Authorized Gift')
      .setDescription(description)
      .setFooter({
        text: `Page 1 / ${Math.max(
          1,
          Math.ceil(results.length / PAGE_SIZE)
        )}`,
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gift:page:${session.id}:0`)
        .setLabel(' • Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId(`gift:confirm:${session.id}`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`gift:cancel:${session.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`gift:page:${session.id}:1`)
        .setLabel('Next • ')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(results.length <= PAGE_SIZE)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  },
};