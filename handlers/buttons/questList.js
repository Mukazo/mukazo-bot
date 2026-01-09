const listCommand = require('../../commands/subcommands/quest/list');

module.exports = async function questListButton(interaction) {
  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith('quest:list:')) return;

  // VERY IMPORTANT
  await interaction.deferUpdate();

  const [, , pageStr] = interaction.customId.split(':');
  const page = Number(pageStr);

  // Fake options injection so list.js can reuse logic
  interaction.options.getInteger = (name) => {
    if (name === 'page') return page;
    return null;
  };

  interaction.options.getString = () => null;

  return listCommand.execute(interaction);
};