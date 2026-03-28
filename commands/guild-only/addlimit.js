const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addlimit')
    .setDescription('Add temporary extra uses to brew or cast.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to modify')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Which command to boost limit')
        .setRequired(true)
        .addChoices(
          { name: 'Cast', value: 'cast' },
          { name: 'Brew', value: 'brew' }
        )
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('How many extra limits to add this month')
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const command = interaction.options.getString('command');
    const amount = interaction.options.getInteger('amount');

    if (!target) {
      return interaction.editReply({ content: 'Target user not found.' });
    }

    if (amount === 0) {
      return interaction.editReply({ content: 'Amount cannot be 0.' });
    }

    const userId = target.id;
    let user = await User.findOne({ userId });
    if (!user) {
      user = await User.create({ userId });
    }

    const currentMonth = new Date().getMonth();

    if (!user.monthlyLimitBoosts) {
      user.monthlyLimitBoosts = {
        cast: { extra: 0, month: currentMonth },
        brew: { extra: 0, month: currentMonth },
      };
    }

    if (!user.monthlyLimitBoosts[command]) {
      user.monthlyLimitBoosts[command] = { extra: 0, month: currentMonth };
    }

    // Reset stale boost month automatically
    if (user.monthlyLimitBoosts[command].month !== currentMonth) {
      user.monthlyLimitBoosts[command].extra = 0;
      user.monthlyLimitBoosts[command].month = currentMonth;
    }

    user.monthlyLimitBoosts[command].extra += amount;

    // Don’t allow it to go below 0
    if (user.monthlyLimitBoosts[command].extra < 0) {
      user.monthlyLimitBoosts[command].extra = 0;
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setDescription([
        '##  /ᐠ - ˕ -マ Monthly Limit Boosts',
        '',
        `> **User:** <@${target.id}>`,
        `> **Command:** ${command}`,
        `> **Change:** ${amount > 0 ? `+${amount}` : amount}`,
        `> **Current Extra Limit:** ${user.monthlyLimitBoosts[command].extra}`,
        '',
        '_This extra limit will reset when the month changes._'
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  },
};