const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  AttachmentBuilder,
} = require('discord.js');

const path = require('path');
const Canvas = require('canvas');

const User = require('../../models/User');
const Series = require('../../models/Series');

/* ===========================
   CATEGORY CONFIG
=========================== */

// Always enabled
const AUTO_CATEGORIES = ['monthlies', 'events', 'specials'];

// User-selectable
const SELECTABLE_CATEGORIES = [
  'music',
  'animanga',
  'video games',
  'entertainment',
];

// Display names
const CATEGORY_LABELS = {
  music: 'Music',
  animanga: 'Animanga',
  'video games': 'Video Games',
  entertainment: 'Entertainment',
  monthlies: 'Monthlies',
  events: 'Events',
  specials: 'Specials',
};

// Category descriptions
const CATEGORY_DESCRIPTIONS = {
  music: 'Artists, Groups, Soloists, etc',
  animanga: 'Animes, Mangas, Donghuas, Manhwas, etc',
  'video games': 'Shooter, Stories, Gacha, etc',
  entertainment: 'Series, Movies, Cartoons, etc',
};

// How many random series to show
const SERIES_SAMPLE_SIZE = 4;

/* ===========================
   CANVAS GRID RENDERER
=========================== */

async function renderSeriesGrid(series) {
  const cols = 2;
  const size = 256;
  const padding = 16;

  const rows = Math.ceil(series.length / cols);
  const width = cols * size + (cols + 1) * padding;
  const height = rows * size + (rows + 1) * padding;

  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2f3136';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < series.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    const x = padding + col * (size + padding);
    const y = padding + row * (size + padding);

    try {
      const img = await Canvas.loadImage(series[i].localImagePath);
      ctx.drawImage(img, x, y, size, size);
    } catch {}
  }

  return canvas.toBuffer();
}

/* ===========================
   UTILS
=========================== */

function pickRandom(array, count) {
  return [...array].sort(() => 0.5 - Math.random()).slice(0, count);
}

/* ===========================
   COMMAND
=========================== */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up your category preferences'),

  async execute(interaction) {

    // Ensure user + auto categories
    await User.updateOne(
      { userId: interaction.user.id },
      {
        $addToSet: {
          enabledCategories: { $each: AUTO_CATEGORIES },
        },
      },
      { upsert: true }
    );

    let page = -1; // -1 = front page
    let finished = false;

    /* ===========================
       PAGE BUILDERS
    =========================== */

    function buildFrontPage() {
      return new EmbedBuilder()
        .setTitle('Bot Acknowledgement & Setup')
        .setColor('#a4ef8e')
        .setDescription(
          [
            '# **Please read before continuing:**',
            '## Bot Rules',
            '• No command abuse, exploits, or automation',
            '• No alting, massgifting, scamming or cross-trading',
            '## Beginner Guide',
            '• ',
            '## Useful Links',
            '[Support Server](https://discord.gg/UQ7PbRDztK)',
            '',
            '_Click **Continue** to begin setup._',
          ].join('\n')
        );
    }

    async function buildCategoryPage(category) {
      const user = await User.findOne({ userId: interaction.user.id }).lean();
      const enabled = user.enabledCategories.includes(category);

      const allSeries = await Series.find({ category }).lean();
      const examples = pickRandom(allSeries, SERIES_SAMPLE_SIZE);

      const embed = new EmbedBuilder()
        .setTitle(`Category Preference Selection`)
        .setColor(enabled ? 0x57f287 : 0xed4245)
        .setDescription(
          [
            `${CATEGORY_LABELS[category]} Cards`,
            CATEGORY_DESCRIPTIONS[category] ?? '',
            '',
            `**Status:** ${enabled ? 'Enabled' : 'Disabled'}`,
            '',
            examples.length
              ? 'Below are example series in this category.'
              : '_No series available yet for this category._',
          ].join('\n')
        );

      const files = [];

      if (examples.length) {
        const buffer = await renderSeriesGrid(examples);
        const attachment = new AttachmentBuilder(buffer, {
          name: 'series-grid.png',
        });

        embed.setImage('attachment://series-grid.png');
        files.push(attachment);
      }

      return { embeds: [embed], files };
    }

    async function buildSummaryPage() {
      const user = await User.findOne({ userId: interaction.user.id }).lean();

      return new EmbedBuilder()
        .setTitle('Setup Complete')
        .setColor('Blurple')
        .setDescription(
          [
            '**Enabled Categories:**',
            ...user.enabledCategories.map(c => `• ${CATEGORY_LABELS[c] ?? c}`),
            '',
            '_You can run `/setup` again at any time to change this._',
          ].join('\n')
        );
    }

    function frontControls() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('continue')
          .setLabel('Continue')
          .setStyle(ButtonStyle.Success)
      );
    }

    function categoryControls(category) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('⬅')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('➡')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === SELECTABLE_CATEGORIES.length - 1),

        new ButtonBuilder()
          .setCustomId(`toggle:${category}`)
          .setLabel('Toggle')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('finish')
          .setLabel('Finish Setup')
          .setStyle(ButtonStyle.Success)
      );
    }

    /* ===========================
       INITIAL RENDER
    =========================== */

    await interaction.editReply({
      embeds: [buildFrontPage()],
      components: [frontControls()],
    });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    /* ===========================
       COLLECTOR
    =========================== */

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'This setup is not for you.', ephemeral: true });
      }

      await btn.deferUpdate();

      if (btn.customId === 'continue') page = 0;
      if (btn.customId === 'prev') page--;
      if (btn.customId === 'next') page++;

      if (btn.customId.startsWith('toggle:')) {
        const category = btn.customId.split(':')[1];
        const user = await User.findOne({ userId: interaction.user.id }).lean();

        const enabled = user.enabledCategories.includes(category);

        await User.updateOne(
          { userId: interaction.user.id },
          enabled
            ? { $pull: { enabledCategories: category } }
            : { $addToSet: { enabledCategories: category } }
        );
      }

      if (btn.customId === 'finish') {
        finished = true;
        collector.stop();
        return;
      }

      if (page === -1) {
        return interaction.editReply({
          embeds: [buildFrontPage()],
          components: [frontControls()],
          files: [],
        });
      }

      const category = SELECTABLE_CATEGORIES[page];
      const data = await buildCategoryPage(category);

      await interaction.editReply({
        embeds: data.embeds,
        files: data.files,
        components: [categoryControls(category)],
      });
    });

    /* ===========================
       END
    =========================== */

    collector.on('end', async () => {
      if (!finished) {
        return interaction.editReply({
          content: 'Setup timed out. You can run `/setup` again.',
          embeds: [],
          components: [],
          files: [],
        });
      }

      const summary = await buildSummaryPage();

      await interaction.editReply({
        embeds: [summary],
        components: [],
        files: [],
      });
    });
  },
};
