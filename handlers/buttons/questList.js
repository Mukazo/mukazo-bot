const questList = require('../../commands/subcommands/quest/list');

module.exports = async function questListButton(interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('quest:list:')) return;

  await interaction.deferUpdate();

  const [, , pageStr] = interaction.customId.split(':');
  const page = Number(pageStr) || 0;

  const ownerId = interaction.message?.interaction?.user?.id;
      if (ownerId && interaction.user.id !== ownerId) {
        await interaction.followUp({ content: "These buttons aren't yours.", flags: 1 << 6 }).catch(()=>{});
        return;
      }

  return questList.execute(interaction, { page });
};