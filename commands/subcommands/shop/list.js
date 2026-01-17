const { EmbedBuilder } = require('discord.js');
const User = require('../../../models/User');

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const user = await User.findOne({ userId });

    function getPityData(user, pack) {
  const data = user.pityData?.get?.(pack) || {};  // ✅ safe access for Map
  return {
    codes: data.codes || [],
    count: data.count || 0,
    until: Math.max(0, 5 - (data.count || 0)),
    lastUsed: data.lastUsed || null
  };
}

    const events = getPityData(user, 'events');
    const monthlies = getPityData(user,'monthlies');

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setColor('#2f3136')
      .setDescription([
        `# Mukazo\'s Packs Shop`,
        `## <:spack:1461915131767427338> Selective Pack`,
        `↪︎ Pack Price: <:Wirlies:1455924065972785375> 500`,
        `↪︎ Each pack contains 5 cards.`,
        `↪︎ 70% chance ‹ getting groups or names.`,
        `## <:epack:1461915053883129971> Events Pack`,
        `↪︎ Pack Price: <:Wirlies:1455924065972785375> 500 & <:Key:1456059698582392852> 4`,
        `↪︎ Each pack contains 4 cards.`,
        `↪︎ 75% chance ‹ pity cards after 5 packs.`,
        `## <:mpack:1461915089497096263> Monthlies Pack`,
        `↪︎ Pack Price: <:Wirlies:1455924065972785375> 500 & <:Key:1456059698582392852> 4`,
        `↪︎ Each pack contains 4 cards.`,
        `↪︎ 75% chance ‹ pity cards after 5 packs.`,
        '',
        `**✢ Pity Preferences:**`,
        `-# Events: (${events.until > 0 ? `In ${events.until} Packs` : 'Pity Active'}) \n${events.codes.length ? events.codes.map(c => `\`${c}\``).join('\n') : '\`NONE\`'}`,
        `-# Monthlies: (${monthlies.until > 0 ? `In ${monthlies.until} Packs` : 'Pity Active'}) \n${monthlies.codes.length ? monthlies.codes.map(c => `\`${c}\``).join('\n') : '\`NONE\`'}`
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }
};