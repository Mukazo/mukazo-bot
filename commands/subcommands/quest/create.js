const Quest = require('../../../models/Quest');

module.exports = {
  async execute(interaction) {
    const key = interaction.options.getString('key');
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const category = interaction.options.getString('category');
    const mode = interaction.options.getString('mode');
    const trigger = interaction.options.getString('trigger') || 'any';

    const count = interaction.options.getInteger('count');
    const commandName = interaction.options.getString('command_name');

    const version = interaction.options.getInteger('version');
    const group = interaction.options.getString('group');
    const era = interaction.options.getString('era');

    const minWirlies = interaction.options.getInteger('min_wirlies');
    const minKeys = interaction.options.getInteger('min_keys');

    const rewardWirlies = interaction.options.getInteger('reward_wirlies') ?? 0;
    const rewardKeys = interaction.options.getInteger('reward_keys') ?? 0;

    const expiresInHours = interaction.options.getInteger('expires_in_hours');
    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600_000) : null;

    // Validation
    if (mode === 'count') {
      if (typeof count !== 'number' || count <= 0) {
        return interaction.editReply({ content: '❌ Count quests require a valid `count` (> 0).' });
      }
    }

    if (mode === 'completion') {
      // must specify at least one completion dimension
      if (!era && !group && typeof version !== 'number') {
        return interaction.editReply({ content: '❌ Completion quests require at least one of: era, group, version.' });
      }
    }

    await Quest.create({
      key,
      name,
      description,
      category,
      mode,
      trigger: mode === 'completion' ? 'any' : trigger, // trigger irrelevant for completion
      expiresAt,
      conditions: {
        count: mode === 'count' ? count : null,
        commandName: commandName || null,
        version: typeof version === 'number' ? version : null,
        group: group || null,
        era: era || null,
        minWirlies: typeof minWirlies === 'number' ? minWirlies : null,
        minKeys: typeof minKeys === 'number' ? minKeys : null,
      },
      rewards: {
        wirlies: rewardWirlies,
        keys: rewardKeys,
      },
    });

    return interaction.editReply({ content: `Created quest \`${key}\` (${mode}/${category}).` });
  },
};
