const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const cooldowns = require('../../utils/cooldownManager');
const { giveCurrency } = require('../../utils/giveCurrency');

const ROUTES = [
  {
    id: 'alley',
    label: 'Shady Alley',
    description: 'Creep through the dangerous alley',
    emoji: '🌑',
    min: 140,
    max: 230,
    keyChance: 0.20,
    embed: {
      title: 'Shady Alley',
      description: 'You navigated the dark alleys and struck a deal.',
      color: 0x2b2d31,
    },
  },
  {
    id: 'market',
    label: 'Open Market',
    description: 'Navigate through the booming market',
    emoji: '🏪',
    min: 170,
    max: 200,
    keyChance: 0.23,
    embed: {
      title: 'Open Market',
      description: 'You worked the stalls and earned some wirlies.',
      color: 0x57f287,
    },
  },
  {
    id: 'rooftops',
    label: 'Rooftops',
    description: 'Scavenge through the city rooftops',
    emoji: '🏙️',
    min: 120,
    max: 280,
    keyChance: 0.18,
    embed: {
      title: 'Rooftops',
      description: 'You ran the rooftops and came back with a haul.',
      color: 0xed4245,
    },
  },
];

function pickRandomRoutes(count = 3) {
  return [...ROUTES]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('route')
    .setDescription('Choose a route to earn wirlies'),

  async execute(interaction) {
    const ownerId = interaction.user.id;
    const commandName = 'Route';
        const cooldownMs = await cooldowns.getEffectiveCooldown(interaction, commandName);
            if (await cooldowns.isOnCooldown(ownerId, commandName)) {
              const nextTime = await cooldowns.getCooldownTimestamp(ownerId, commandName);
              return interaction.editReply({ content: `Command on cooldown! Try again ${nextTime}.` });
            }
        
            // Now that the interaction is ACKed (by handler), it's safe to start the cooldown
            await cooldowns.setCooldown(ownerId, commandName, cooldownMs);
    const routes = pickRandomRoutes(3);

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '## It\'s time to choose',
        'You embark on an adventure. . .',
        '',
        '> Each route offers different rewards',
        '> Choose a route to see what you will discover!',
    ].join('\n'))
      .setColor(0x5865f2);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`route:${interaction.user.id}`)
      .setPlaceholder('Select a route')
      .addOptions(
        routes.map(r => ({
          label: r.label,
          value: r.id,
          description: r.description,
          emoji: r.emoji,
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      time: 60_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async select => {
      await select.deferUpdate();

      const route = routes.find(r => r.id === select.values[0]);
      if (!route) return;

      const earned = randomInt(route.min, route.max);

const gotKey = Math.random() < (route.keyChance ?? 0);

const user = await giveCurrency(interaction.user.id, {
  wirlies: earned,
  keys: gotKey ? 1 : 0,
});


      const resultEmbed = new EmbedBuilder()
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription([
  `## ${route.embed.title}`,
  route.embed.description,
  '\n',
  `**Earned:**`,
  `+ <:Wirlies:1455924065972785375> ${earned}`,
  gotKey ? '+ 🗝️ 1' : null,
  '\n',
  `__**Balance:**__`,
  `> <:Wirlies:1455924065972785375> ${user.wirlies.toLocaleString()}`,
  `> 🗝️ ${user.keys ?? 0}`,
].filter(Boolean).join('\n'))
        .setColor(route.embed.color);

      row.components[0].setDisabled(true);

      await interaction.editReply({
        embeds: [resultEmbed],
        components: [row],
      });

      collector.stop();
    });

    collector.on('end', async (_, reason) => {
      if (reason !== 'user') {
        row.components[0].setDisabled(true);
        await interaction.editReply({ components: [row] });
      }
    });
  },
};
