const questList = require('../../commands/subcommands/quest/list');

module.exports = async function questListButton(interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('quest:list:')) return;

  await interaction.deferUpdate();

  const [, , pageStr] = interaction.customId.split(':');
  const page = Number(pageStr) || 0;

  return questList.execute(interaction, { page });
};