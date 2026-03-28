const questList = require('../../commands/subcommands/quest/list');

module.exports = async function questListButton(interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('quest:list:')) return;

  await interaction.deferUpdate();

  const parts = interaction.customId.split(':');

  const ownerId = interaction.message?.interaction?.user?.id;
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.followUp({
      content: 'Those buttons are not yours!',
      flags: 1 << 6
    }).catch(() => {});
    return;
  }

  const PAGE_ORDER = ['daily', 'weekly', 'lifetime', 'event'];

  // quest:list:category:<index>
  if (parts[2] === 'category') {
    const categoryIndex = Number(parts[3]) || 0;
    const category = PAGE_ORDER[categoryIndex] ?? 'daily';

    return questList.execute(interaction, {
      category,
      page: 0,
    });
  }

  // quest:list:page:<category>:<page>
  if (parts[2] === 'page') {
    const category = parts[3] || 'daily';
    const page = Number(parts[4]) || 0;

    return questList.execute(interaction, {
      category,
      page,
    });
  }

  // fallback for old button format: quest:list:<page>
  const fallbackPage = Number(parts[2]) || 0;
  return questList.execute(interaction, { page: fallbackPage });
};