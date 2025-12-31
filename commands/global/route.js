const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const giveWirlies = require('../../utils/giveWirlies');
const cooldowns = require('../../utils/cooldownManager');

const ROUTES = [
  {
    id: 'alley',
    label: 'Shady Alley',
    description: 'Risky, but profitable.',
    emoji: '🌑',
    min: 40,
    max: 120,
    embed: {
      title: 'Shady Alley',
      description: 'You navigated the dark alleys and struck a deal.',
      color: 0x2b2d31,
    },
  },
  {
    id: 'market',
    label: 'Open Market',
    description: 'Safe and steady.',
    emoji: '🏪',
    min: 20,
    max: 60,
    embed: {
      title: 'Open Market',
      description: 'You worked the stalls and earned some wirlies.',
      color: 0x57f287,
    },
  },
  {
    id: 'rooftops',
    label: 'Rooftops',
    description: 'High risk, high reward.',
    emoji: '🏙️',
    min: 60,
    max: 160,
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
      .setDescription([
        '## It\'s time to choose . . .',
        '> You embark on an adventure, what route will you be taking this time?',
        '> **Each route offers different rewards, choose carefully.**'
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
      const user = await giveWirlies(interaction.user.id, earned);

      const resultEmbed = new EmbedBuilder()
        .setTitle(route.embed.title)
        .setDescription(
          [
            route.embed.description,
            '',
            `**+${earned} <:Wirlies:1455924065972785375> Wirlies**`,
            `**Balance:** <:Wirlies:1455924065972785375> ${user.wirlies}`,
          ].join('\n')
        )
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
