const summon = require('./summon');

module.exports = async interaction => {
  if (!interaction.isButton()) return false;

  if (interaction.customId.startsWith('summon:')) {
    await summon(interaction);
    return true;
  }

  return false;
};
