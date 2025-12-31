const { SlashCommandBuilder } = require('discord.js');
const Maintenance = require('../../models/Maintenance');

function parseDuration(input) {
  if (!input) return null;

  const match = input.match(/^(\d+)([mhd])$/i);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const ms =
    unit === 'm' ? value * 60_000 :
    unit === 'h' ? value * 3_600_000 :
    value * 86_400_000;

  return Date.now() + ms;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Toggle bot maintenance mode')
    .addStringOption(o =>
      o.setName('duration')
        .setDescription('How long maintenance lasts (e.g. 1h, 2d)')
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason or message shown to users')
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    // permission check (keep your existing role logic if different)
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.editReply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');

    const endsAt = parseDuration(durationInput);

    let maintenance = await Maintenance.findOne();
    if (!maintenance) maintenance = new Maintenance();

    maintenance.active = !maintenance.active;

    if (maintenance.active) {
      maintenance.endsAt = endsAt;
      maintenance.reason = reason ?? null;
    } else {
      maintenance.endsAt = null;
      maintenance.reason = null;
    }

    await maintenance.save();

    return interaction.editReply({
      content: maintenance.active
        ? `Maintenance **ENABLED**${endsAt ? ` until <t:${Math.floor(endsAt / 1000)}:R>` : ''}.`
        : 'Maintenance **DISABLED**.',
      ephemeral: true,
    });
  },
};
