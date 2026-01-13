const summon = require('./summon');
const enchant = require('./enchant');
const gift = require('./gift')
const questList = require('./questList')
const burn = require('./burn')

module.exports = async interaction => {
  if (!interaction.isButton()) return false;

  if (interaction.customId.startsWith('summon:')) {
    await summon(interaction);
    return true;
  }

  if (interaction.customId.startsWith('enchant:')) {
    await enchant(interaction);
    return true;
  }

  if (interaction.customId.startsWith('gift:')) {
    await gift(interaction);
    return true;
  }

  if (interaction.customId.startsWith('quest:list:')) {
    await questList(interaction);
    return true;
  }
  
  if (interaction.customId.startsWith('burn:')) {
    await burn(interaction);
    return true;
  }

  return false;
};