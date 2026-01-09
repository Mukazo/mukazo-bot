const Quest = require('../../../models/Quest');

module.exports = {
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.editReply({ content: 'Admin only.' });
    }
    
    const quest = await Quest.create({
      key: interaction.options.getString('key'),
      name: interaction.options.getString('name'),
      description: interaction.options.getString('description'),
      category: interaction.options.getString('category'),
      type: interaction.options.getString('type'),
      mode: interaction.options.getString('mode'),
      conditions: {
        count: interaction.options.getInteger('count'),
        version: interaction.options.getInteger('version'),
        group: interaction.options.getString('group'),
        era: interaction.options.getString('era'),
      },
      rewards: {
        wirlies: interaction.options.getInteger('wirlies') || 0,
        keys: interaction.options.getInteger('keys') || 0,
      },
    });

    await interaction.editReply({ content: `Created quest **${quest.name}**` });
  },
};
