require('dotenv').config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
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

    const [sourceUser, targetUser] = await Promise.all([
      User.findOne({ userId: fromUser.id }),
      User.findOne({ userId: toUser.id })
    ]);

    if (!sourceUser) return interaction.editReply({ content: 'Source user not found.' });
    if (!targetUser) return interaction.editReply({ content: 'Target user not found.' });

    const moveWirlies = sourceUser.wirlies || 0;
    const moveKeys = sourceUser.keys || 0;

    const fromItems = await CardInventory.find({ userId: fromUser.id });

    let totalCodesMoved = 0;
    let totalQtyMoved = 0;

    for (const item of fromItems) {
      if (!item.quantity || item.quantity <= 0) continue;
      totalCodesMoved++;
      totalQtyMoved += item.quantity;
    }

    // ===========================
    // PREVIEW EMBED
    // ===========================
    const previewEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('Confirm Transfer?')
      .setDescription(
        [
          `**From:** <@${fromUser.id}>`,
          `**To:** <@${toUser.id}>`,
          note ? `**Note:** ${note}` : null,
          '',
          `**Cards:** ${totalCodesMoved}`,
          `**Copies:** ${totalQtyMoved}`,
          `**Wirlies:** <:Wirlies:1455924065972785375> ${moveWirlies}`,
          `**Keys:** <:Key:1456059698582392852> ${moveKeys}`
        ].filter(Boolean).join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('transfer_confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('transfer_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.editReply({
      embeds: [previewEmbed],
      components: [row]
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000
    });

    collector.on('collect', async i => {

      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This is not your confirmation.', ephemeral: true });
      }

      if (i.customId === 'transfer_cancel') {
        collector.stop('cancelled');
        return i.update({
          content: 'Transfer cancelled.',
          embeds: [],
          components: []
        });
      }

      if (i.customId === 'transfer_confirm') {
        collector.stop('confirmed');

        // ===========================
        // EXECUTE TRANSFER
        // ===========================

        const bulkOps = [];

        for (const item of fromItems) {
          if (!item.quantity || item.quantity <= 0) continue;

          bulkOps.push({
            updateOne: {
              filter: { userId: toUser.id, cardCode: item.cardCode },
              update: { $inc: { quantity: item.quantity } },
              upsert: true
            }
          });
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

        targetUser.wirlies += moveWirlies;
        targetUser.keys += moveKeys;

        sourceUser.wirlies = 0;
        sourceUser.keys = 0;

        await targetUser.save();
        await sourceUser.save();

        // ===========================
        // MOD LOG
        // ===========================

        const logChannelId = process.env.TRANSFER_LOG_CHANNEL_ID;
        const logChannel = interaction.client.channels.cache.get(logChannelId);

        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Account Transfer Completed')
            .addFields(
              { name: 'Executor', value: `<@${interaction.user.id}>` },
              { name: 'From', value: `<@${fromUser.id}>`, inline: true },
              { name: 'To', value: `<@${toUser.id}>`, inline: true },
              { name: 'Cards', value: `${totalCodesMoved}`, inline: true },
              { name: 'Copies', value: `${totalQtyMoved}`, inline: true },
              { name: 'Wirlies', value: `${moveWirlies}`, inline: true },
              { name: 'Keys', value: `${moveKeys}`, inline: true },
              { name: 'Note', value: note || 'None' }
            )
            .setTimestamp();

          logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        // ===========================
        // CONFIRM RESPONSE
        // ===========================

        const confirmEmbed = new EmbedBuilder()
          .setColor(0x3BA55D)
          .setDescription(
            [
              '# Transfer Completed',  
              `### From: <@${fromUser.id}>`,
              `### To: <@${toUser.id}>`,
              'Transferred the following:',
              '',
              `**${totalCodesMoved}** Cards`,
              `**${totalQtyMoved}** Copies`,
              `<:Wirlies:1455924065972785375> **${moveWirlies.toLocaleString()}**`,
              `<:Key:1456059698582392852> **${moveKeys.toLocaleString()}**`
            ].join('\n')
          )
          .setTimestamp();

        return i.update({
          embeds: [confirmEmbed],
          components: []
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: 'Transfer expired.',
          embeds: [],
          components: []
        });
      }
    });
  }
};