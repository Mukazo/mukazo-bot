const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  AttachmentBuilder,
} = require('discord.js');

const Canvas = require('canvas');

const User = require('../../models/User');
const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const Series = require('../../models/Series');
const generateVersion = require('../../utils/generateVersion');

const CARDS_TO_GIVE = 3;
const SERIES_OPTIONS = 3;
const MENU_TIMEOUT = 120_000;

const SERIES_CARD_MATCH_FIELD = 'group'; // series.code matches card.group

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function randomUnique(arr, count) {
  const copy = [...arr];
  const picked = [];
  const max = Math.min(count, copy.length);

  for (let i = 0; i < max; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    picked.push(copy[idx]);
    copy.splice(idx, 1);
  }

  return picked;
}

function buildEligibleCardMatch(seriesCodes) {
  return {
    active: true,
    batch: null,
    [SERIES_CARD_MATCH_FIELD]: { $in: seriesCodes },
    $and: [
      {
        $or: [
          { releaseAt: null },
          { releaseAt: { $lte: new Date() } },
        ],
      },
      {
        $or: [
          { availableQuantity: null },
          { $expr: { $lt: ['$timesPulled', '$availableQuantity'] } },
        ],
      },
    ],
  };
}

async function buildSeriesCanvas(seriesOptions) {
  const WIDTH = 1050;
  const HEIGHT = 420;
  const CARD_W = 310;
  const CARD_H = 310;
  const GAP = 30;
  const START_X = Math.floor((WIDTH - ((CARD_W * 3) + (GAP * 2))) / 2);
  const Y = 80;

  const canvas = Canvas.createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  // background
  ctx.fillStyle = '#1f2229';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // subtle panel
  ctx.fillStyle = '#2b3038';
  ctx.fillRect(20, 20, WIDTH - 40, HEIGHT - 40);

  // title bar
  ctx.fillStyle = '#353b45';
  ctx.fillRect(20, 20, WIDTH - 40, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Sans';
  ctx.textAlign = 'center';
  ctx.fillText('Choose 1 out of 3 Series', WIDTH / 2, 52);

  const images = await Promise.all(
  seriesOptions.map(series =>
    series.localImagePath
      ? Canvas.loadImage(series.localImagePath).catch(() => null)
      : null
  )
);

  for (let i = 0; i < seriesOptions.length; i++) {
    const series = seriesOptions[i];
    const img = images[i];
    const x = START_X + i * (CARD_W + GAP);

    // card background
    ctx.fillStyle = '#14171c';
    ctx.fillRect(x, Y, CARD_W, CARD_H);

    if (img) {
      ctx.drawImage(img, x, Y, CARD_W, CARD_H);
    } else {
      ctx.fillStyle = '#444b57';
      ctx.fillRect(x, Y, CARD_W, CARD_H);
    }

    // dark footer label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x, Y + CARD_H - 62, CARD_W, 62);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Sans';
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}`, x + CARD_W / 2, Y + CARD_H - 35);
  }

  return new AttachmentBuilder(canvas.toBuffer(), {
    name: 'assemble_series.png',
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assemble')
    .setDescription('Choose 1 of 3 random series and receive 3 cards from that series.'),

  async execute(interaction) {
    const userId = interaction.user.id;

    const user = await User.findOne({ userId })
      .select('enabledCategories')
      .lean();

    if (!user) {
      return interaction.editReply({
        content: 'User not found.',
      });
    }

    const enabled = (user.enabledCategories || []).map(normalize);

    if (!enabled.length) {
      return interaction.editReply({
        content: 'You have no enabled categories. Please run `/start` or `/setup` first.',
      });
    }
    const seriesDocs = await Series.find({
  category: { $in: enabled },
})
  .select('code name category localImagePath description')
  .lean();

    if (!seriesDocs.length) {
      return interaction.editReply({
        content: 'No eligible series were found for your enabled categories.',
      });
    }

    const seriesCodes = seriesDocs
      .map(s => String(s.code || '').trim())
      .filter(Boolean);

    if (!seriesCodes.length) {
      return interaction.editReply({
        content: 'No valid series codes were found.',
      });
    }

    // Count cards by group, because series.code === card.group
    const eligibleCounts = await Card.aggregate([
      {
        $match: buildEligibleCardMatch(seriesCodes),
      },
      {
        $group: {
          _id: `$${SERIES_CARD_MATCH_FIELD}`,
          count: { $sum: 1 },
        },
      },
    ]);

    const eligibleMap = new Map(
      eligibleCounts.map(row => [String(row._id), row.count])
    );

    const eligibleSeries = seriesDocs.filter(series => {
      const count = eligibleMap.get(String(series.code)) || 0;
      return count >= CARDS_TO_GIVE;
    });

    if (eligibleSeries.length < 1) {
      return interaction.editReply({
        content: 'No eligible series currently have enough cards to assemble.',
      });
    }

    const optionsPool = randomUnique(eligibleSeries, SERIES_OPTIONS);

    const attachment = await buildSeriesCanvas(optionsPool);

    const embed = new EmbedBuilder()
      .setDescription([
        '## Assemble a Series',
        '',
        '> Choose **1** of the 3 series below.',
        `> You will receive **${CARDS_TO_GIVE}** cards from the chosen series.`,
      ].join('\n'))
      .setImage('attachment://assemble_series.png');

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`assemble:${userId}`)
      .setPlaceholder('Choose a series...')
      .addOptions(
        optionsPool.map(series =>
          new StringSelectMenuOptionBuilder()
            .setLabel(series.name)
            .setValue(series.code)
            .setDescription(
              `${series.category} • ${(eligibleMap.get(String(series.code)) || 0).toLocaleString()} eligible cards`
                .slice(0, 100)
            )
        )
      );
      const row = new ActionRowBuilder().addComponents(menu);

    const message = await interaction.editReply({
      embeds: [embed],
      files: [attachment],
      components: [row],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: MENU_TIMEOUT,
    });

    collector.on('collect', async select => {
      if (select.user.id !== userId) {
        return select.reply({
          content: 'This menu is not for you.',
          ephemeral: true,
        });
      }

      const selectedCode = select.values?.[0];
      const selectedSeries = optionsPool.find(s => s.code === selectedCode);

      if (!selectedSeries) {
        return select.reply({
          content: 'That series is no longer valid.',
          ephemeral: true,
        });
      }

      const pool = await Card.find({
        ...buildEligibleCardMatch([selectedCode]),
        group: selectedCode,
      })
        .select('cardCode group name era emoji version')
        .lean();

      if (pool.length < CARDS_TO_GIVE) {
        return select.update({
          embeds: [
            new EmbedBuilder()
              .setDescription('That series no longer has enough eligible cards available.')
          ],
          components: [],
          files: [],
        });
      }

      const chosenCards = randomUnique(pool, CARDS_TO_GIVE);

      await CardInventory.bulkWrite(
        chosenCards.map(card => ({
          updateOne: {
            filter: { userId, cardCode: card.cardCode },
            update: { $inc: { quantity: 1 } },
            upsert: true,
          },
        }))
      );

      const resultEmbed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle(`Assembled: ${selectedSeries.name}`)
        .setDescription(
          chosenCards.map(card => {
            const emoji = card.emoji || generateVersion(card);
            const eraText = card.era ? `( ${card.era} )` : '';
            return `• ${emoji} **${card.group}** __${card.name}__ ${eraText} \`${card.cardCode}\``;
          }).join('\n')
        );

        if (selectedSeries.description) {
        resultEmbed.addFields({
          name: 'Series',
          value: selectedSeries.description.slice(0, 1024),
        });
      }

      if (selectedSeries.localImagePath) {
  const safeCode = String(selectedSeries.code)
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '_');

const thumbName = `series_${safeCode}.png`;

  await select.update({
    embeds: [
      resultEmbed.setThumbnail(`attachment://${thumbName}`)
    ],
    components: [],
    files: [
      {
        attachment: selectedSeries.localImagePath,
        name: thumbName,
      }
    ],
  });

  collector.stop('selected');
  return;
}

      await select.update({
        embeds: [resultEmbed],
        components: [],
        files: [],
      });

      collector.stop('selected');
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'selected') return;

      const disabledMenu = StringSelectMenuBuilder.from(menu).setDisabled(true);
      const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);

      await message.edit({
        components: [disabledRow],
      }).catch(() => {});
    });
  },
};