const Quest = require('../../../models/Quest');

module.exports = {
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.editReply({ content: 'Admin only.' });
    }

    const expiresOn = interaction.options.getString('expires_on');

let expiresAt = null;

if (expiresOn) {
  // Force end-of-day UTC to avoid timezone bugs
  expiresAt = new Date(`${expiresOn}T23:59:59.999Z`);

  if (isNaN(expiresAt.getTime())) {
    return interaction.reply({
      content: 'Invalid date format. Use YYYY-MM-DD.',
      ephemeral: true,
    });
  }
}
    
    const quest = await Quest.create({
      key: interaction.options.getString('key'),
      name: interaction.options.getString('name'),
      description: interaction.options.getString('description'),
      category: interaction.options.getString('category'),
      trigger: interaction.options.getString('trigger'),
      mode: interaction.options.getString('mode'),
      conditions: {
        count: interaction.options.getInteger('count'),
        commandName: interaction.options.getString('command_name'),
        version: interaction.options.getInteger('version'),
        group: interaction.options.getString('group'),
        era: interaction.options.getString('era'),
      },
      rewards: {
        wirlies: interaction.options.getInteger('reward_wirlies') || 0,
        keys: interaction.options.getInteger('reward_keys') || 0,
      },
      expiresAt,
    });

    await interaction.editReply({ content: `Created quest **${quest.name}**` });
  },
};
