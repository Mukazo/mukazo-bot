const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
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
const AUTO_CATEGORIES = ['specials'];
const REQUIRED_CATEGORIES = [
  'entertainment',
  'video games',
  'animanga',
  'music',
];

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
  music: 'Asia Centered Artists, Groups, Soloists, etc',
  animanga: 'Animes, Mangas, Donghuas, Manhwas, etc',
  'video games': 'Shooter, Story, Gacha, Fighting, etc',
  entertainment: 'Series, Movies, Cartoons, Dramas, etc',
};

// How many random series to show
const SERIES_SAMPLE_SIZE = 9;

/* ===========================
   CANVAS GRID RENDERER
=========================== */

async function renderSeriesGrid(series) {
  const cols = 3;
  const size = 256;
  const padding = 16;

  const rows = Math.ceil(series.length / cols);
  const width = cols * size + (cols + 1) * padding;
  const height = rows * size + (rows + 1) * padding;

  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

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
            '• Start your journey by checking out \`/cooldowns\`',
            '• Afterwards, find & run the commands that show up',
            '• You can use \`/search\` to look for available cards',
            '• View \`/inventory\` & gift items with \`gift\`',
            '## Useful Links',
            '[Main & Support Server](https://discord.gg/UQ7PbRDztK)',
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
            `# ${CATEGORY_LABELS[category]} Cards`,
            CATEGORY_DESCRIPTIONS[category] ?? '',
            '',
            `> To enable a category click the "Toggle" button`,
            `> **Status:** ${enabled ? 'Enabled' : 'Disabled'}`,
            '',
            examples.length
              ? 'Below are examples in this category.'
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

      // ✅ Add select menu only for Music category
let musicSelectRow = null;

if (category === 'music') {
  musicSelectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('setup:musicfilter')
      .setPlaceholder('Disable Other Regions Music?')
      .addOptions([
        { label: 'Yes', value: 'disable' },
        { label: 'No', value: 'enable' }
      ])
  );
}

      return {
  embeds: [embed],
  files,
  components: musicSelectRow
    ? [categoryControls(category), musicSelectRow]
    : [categoryControls(category)]
};
    }

    async function buildSummaryPage() {
      const user = await User.findOne({ userId: interaction.user.id }).lean();

      return new EmbedBuilder()
        .setTitle('Setup Complete')
        .setColor('#a4ef8e')
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
          .setLabel(' • Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next • ')
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

      } else if (btn.isStringSelectMenu() && btn.customId === 'setup:musicfilter') {
      const selected = btn.values?.[0];
      const user = await User.findOne({ userId: interaction.user.id }) || new User({ userId });

      if (selected === 'disable') {
        user.enabledCategories = user.enabledCategories?.filter(c => c !== 'other music') || [];
      } else if (selected === 'enable') {
        if (!user.enabledCategories.includes('other music')) {
          user.enabledCategories.push('other music');
        }
      }

      await user.save();

      // ✅ Edit the CURRENT embed to include a status line
      const currentEmbed = btn.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(currentEmbed).setDescription(
        currentEmbed.description + `\n\n**Other Regions Music have been ${selected === 'disable' ? 'disabled' : 'enabled'}**.`
      );

      return btn.update({
        embeds: [updatedEmbed],
        components: btn.message.components,
      });
    }

      if (btn.customId === 'finish') {
  const user = await User.findOne({ userId: interaction.user.id }).lean();

  const hasRequiredCategory = user.enabledCategories.some(cat =>
    REQUIRED_CATEGORIES.includes(cat)
  );

  if (!hasRequiredCategory) {
    return btn.followUp({
      content:
        'You must enable at least **one** of the following categories before finishing setup:\n' +
        '> Entertainment\n' +
        '> Video Games\n' +
        '> Animanga\n' +
        '> Music',
      ephemeral: true,
    });
  }

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
  components: data.components, // ✅ will include select menu for "music" category
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
