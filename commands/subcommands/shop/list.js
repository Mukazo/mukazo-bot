const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    until: Math.max(0, 3 - (data.count || 0)),
    lastUsed: data.lastUsed || null
  };
}

    const events = getPityData(user, 'events');
    const monthlies = getPityData(user,'monthlies');

    let currentPage = 0;

const page1 = new EmbedBuilder()
  .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
  .setColor('#2f3136')
  .setDescription([
    `# Mukazo's Packs Shop`,
    `## <:epack:1461915053883129971> Events Pack`,
    `↪︎ Pack Price: <:Wirlies:1455924065972785375> 675 & <:Key:1456059698582392852> 4`,
    `↪︎ Each pack contains 4 Event cards.`,
    `↪︎ 80% pity chance ‹ activates on 4th pack.`,
    `## <:mpack:1461915089497096263> Monthlies Pack`,
    `↪︎ Pack Price: <:Wirlies:1455924065972785375> 675 & <:Key:1456059698582392852> 4`,
    `↪︎ Each pack contains 4 Monthlies cards.`,
    `↪︎ 80% pity chance ‹ activates on 4th pack.`,
    '',
    `**✢ Pity Preferences:**`,
    `-# Events: (${events.until > 0 ? `In ${events.until} Packs` : 'Pity Active'})`,
    `${events.codes.length ? events.codes.map(c => `\`${c}\``).join('\n') : '\`NONE\`'}`,
    `-# Monthlies: (${monthlies.until > 0 ? `In ${monthlies.until} Packs` : 'Pity Active'})`,
    `${monthlies.codes.length ? monthlies.codes.map(c => `\`${c}\``).join('\n') : '\`NONE\`'}`
  ].join('\n'));

const page2 = new EmbedBuilder()
  .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
  .setColor('#2f3136')
  .setDescription([
    `# Mukazo's Packs Shop`,
    `## <:spack:1461915131767427338> Selective Pack`,
    `↪︎ Pack Price: <:Wirlies:1455924065972785375> 750`,
    `↪︎ Each pack contains 5 Regular cards.`,
    `↪︎ 65% chance ‹ of filtered groups/names.`,
    `## <:ppack:1502737825332990073> Snippets Pack`,
    `↪︎ Pack Price: <:Wirlies:1455924065972785375> 1250 & <:Key:1456059698582392852> 2`,
    `↪︎ Each pack contains 3 Snippet cards.`,
    `## <:cpack:1502737910472904705> Customs Pack`,
    `↪︎ Pack Types: **Premade** & **Commission**`,
    `↪︎ Premade Price: <:Wirlies:1455924065972785375> 375,000`,
    `↪︎ Commission Price: <:Wirlies:1455924065972785375> 500,000`,
    `↪︎ Premade customs must be created by you or someone else.`,
    `↪︎ Commission customs are created by Mukazo Designers.`,
    `↪︎ To claim a custom, create a ticket in Mukazo's Support Server.`
  ].join('\n'));

const pages = [page1, page2];

const row = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('shop_prev')
    .setLabel(' • Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 0),

  new ButtonBuilder()
    .setCustomId('shop_next')
    .setLabel('Next • ')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === pages.length - 1)
);

const msg = await interaction.editReply({
  embeds: [pages[currentPage]],
  components: [row()],
  ephemeral: true
});

const collector = msg.createMessageComponentCollector({ time: 120000 });

collector.on('collect', async btn => {
  if (btn.user.id !== interaction.user.id) {
    return btn.reply({ content: 'Not your menu.', ephemeral: true });
  }

  if (btn.customId === 'shop_next') currentPage++;
  if (btn.customId === 'shop_prev') currentPage--;

  await btn.update({
    embeds: [pages[currentPage]],
    components: [row()],
  });
});

collector.on('end', async () => {
  if (msg.editable) {
    await msg.edit({ components: [] });
  }
});
  }
};