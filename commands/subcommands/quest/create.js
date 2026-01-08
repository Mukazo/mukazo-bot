const Quest = require('../../../models/Quest');

module.exports = {
  async execute(interaction) {
    // ADMIN CHECK HERE (since subcommand perms are not supported)
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.editReply({ content: 'Admin only.' });
    }

    const now = new Date();
    const expiresHours = interaction.options.getInteger('expires_in_hours');

    const quest = await Quest.create({
      key: interaction.options.getString('key'),
      name: interaction.options.getString('name'),
      description: interaction.options.getString('description'),

      category: interaction.options.getString('category'),
      trigger: interaction.options.getString('trigger'),
      mode: interaction.options.getString('mode'),

      prerequisiteKey: interaction.options.getString('prerequisite') || null,
      expiresAt: expiresHours ? new Date(now.getTime() + expiresHours * 3600_000) : null,

      conditions: {
        count: interaction.options.getInteger('count') ?? null,
        commandName: interaction.options.getString('command_name') || null,
        minWirlies: interaction.options.getInteger('min_wirlies') ?? null,
        minKeys: interaction.options.getInteger('min_keys') ?? null,

        version: interaction.options.getInteger('version') ?? null,
        group: interaction.options.getString('group') ?? null,
        era: interaction.options.getString('era') ?? null,
      },

      rewards: {
        wirlies: interaction.options.getInteger('reward_wirlies') ?? 0,
        keys: interaction.options.getInteger('reward_keys') ?? 0,
      },
    });

    await interaction.editReply({ content: `Quest created: **${quest.name}** (\`${quest.key}\`)` });
  },
};
