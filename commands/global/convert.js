const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

const WEEKLY_LIMIT = 40;
const COST = 2000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Convert Wirlies into Keys')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of keys to convert - 2000 wirlies per key')
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    let user = await User.findOne({ userId });
    if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });

    const requested = interaction.options.getInteger('amount');

    // Initialize or reset convert log
    if (!user.convertLog || !user.convertLog.resetAt || new Date() > user.convertLog.resetAt) {
      user.convertLog = {
        count: 0,
        resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };
    }

    const remaining = WEEKLY_LIMIT - user.convertLog.count;
    if (remaining <= 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Limit Reached')
            .setDescription(`You've already converted the maximum of <:Key:1456059698582392852> **${WEEKLY_LIMIT}** this week.\nTry again <t:${Math.floor(new Date(user.convertLog.resetAt).getTime() / 1000)}:R>.`)
        ],
        ephemeral: true
      });
    }

    const convertible = Math.min(requested, remaining);
    const totalCost = convertible * COST;

    if (user.wirlies < totalCost) {
      return interaction.reply({ content: `You need **<:Wirlies:1455924065972785375> ${totalCost}** to convert <:Key:1456059698582392852> ${convertible}.`, ephemeral: true });
    }

    // Perform conversion
    user.wirlies -= totalCost;
    user.keys += convertible;
    user.convertLog.count += convertible;
    await user.save();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setDescription([
            `## Conversion Successful`,
            `- Converted **<:Wirlies:1455924065972785375> ${totalCost}** into **<:Key:1456059698582392852> ${convertible}**`,
            `- You have **${WEEKLY_LIMIT - user.convertLog.count}** conversions left this week.`,
            requested > convertible ? `- You requested <:Key:1456059698582392852> ${requested}, but only <:Key:1456059698582392852> ${convertible} were converted due to your limit.` : null
          ].filter(Boolean).join('\n'))
      ],
      ephemeral: true
    });
  }
};