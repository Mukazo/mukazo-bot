require('dotenv').config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const CardInventory = require('../../models/CardInventory');
const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer cards & currency from one user to another.')
    .addUserOption(opt =>
      opt.setName('from')
        .setDescription('User to transfer FROM')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('to')
        .setDescription('User to transfer TO')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('note')
        .setDescription('Optional note')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    const fromUser = interaction.options.getUser('from');
    const toUser = interaction.options.getUser('to');
    const note = interaction.options.getString('note') || '';

    if (fromUser.id === toUser.id) {
      return interaction.editReply({ content: '`from` and `to` must be different users.' });
    }

    // ===========================
    // LOAD USERS
    // ===========================

    const [sourceUser, targetUser] = await Promise.all([
      User.findOne({ userId: fromUser.id }),
      User.findOne({ userId: toUser.id })
    ]);

    if (!sourceUser) return interaction.editReply({ content: 'Source user not found in database.' });
    if (!targetUser) return interaction.editReply({ content: 'Target user not found in database.' });

    const moveWirlies = sourceUser.wirlies || 0;
    const moveKeys = sourceUser.keys || 0;

    // ===========================
    // MOVE ALL CARDS (BULK)
    // ===========================

    let totalCodesMoved = 0;
    let totalQtyMoved = 0;

    const fromItems = await CardInventory.find({ userId: fromUser.id });

    if (fromItems.length > 0) {
      const bulkOps = [];

      for (const item of fromItems) {
        if (!item.quantity || item.quantity <= 0) continue;

        totalCodesMoved++;
        totalQtyMoved += item.quantity;

        // Add to target
        bulkOps.push({
          updateOne: {
            filter: { userId: toUser.id, cardCode: item.cardCode },
            update: { $inc: { quantity: item.quantity } },
            upsert: true
          }
        });

        // Zero out source
        bulkOps.push({
          updateOne: {
            filter: { userId: fromUser.id, cardCode: item.cardCode },
            update: { $set: { quantity: 0 } }
          }
        });
      }
      if (bulkOps.length > 0) {
        await CardInventory.bulkWrite(bulkOps);
      }
    }

    // ===========================
    // TRANSFER CURRENCY
    // ===========================

    if (moveWirlies > 0 || moveKeys > 0) {
      targetUser.wirlies += moveWirlies;
      targetUser.keys += moveKeys;

      sourceUser.wirlies = 0;
      sourceUser.keys = 0;

      await targetUser.save();
      await sourceUser.save();
    }

    // ===========================
    // CONFIRM EMBED
    // ===========================

    const currencySummary = [
      moveWirlies > 0
        ? `• <:Wirlies:1455924065972785375> **${moveWirlies.toLocaleString()}**`
        : null,
      moveKeys > 0
        ? `• <:Key:1456059698582392852> **${moveKeys.toLocaleString()}**`
        : null
    ].filter(Boolean);

    const embed = new EmbedBuilder()
      .setColor(0x3BA55D)
      .setTitle('Transfer Complete')
      .setDescription(
        [
          `**From:** <@${fromUser.id}>`,
          `**To:** <@${toUser.id}>`,
          note ? `**Note:** ${note}` : null
        ].filter(Boolean).join('\n')
      )
      .addFields(
        { name: 'Card Codes Moved', value: `${totalCodesMoved}`, inline: true },
        { name: 'Total Quantity Moved', value: `${totalQtyMoved}`, inline: true },
        { name: 'Currency Moved', value: currencySummary.join('\n') || 'None' }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};