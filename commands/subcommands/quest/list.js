const { EmbedBuilder } = require('discord.js');
const Quest = require('../../../models/Quest');
const UserQuest = require('../../../models/UserQuest');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');

const { ensureAssigned } = require('../../../utils/quest/assign');
const { checkCompletionProgress } = require('../../../utils/quest/completion');
const rewards = require('../../../utils/quest/rewards');

/* =========================
   Helpers
========================= */

function fmtRewards(r) {
  if (!r) return '—';
  const parts = [];
  if (r.wirlies > 0) parts.push(`<:Wirlies:1455924065972785375> ${r.wirlies}`);
  if (r.keys > 0) parts.push(`<:Key:1456059698582392852> ${r.keys}`);
  return parts.length ? parts.join(' • ') : '—';
}

function fmtQuest(q, uq) {
  const cur = uq?.progress ?? 0;
  const max = uq?.goal ?? (q.conditions?.count ?? 0);
  const pct = max > 0 ? Math.floor((cur / max) * 100) : 0;

  return [
    `${uq?.completed ? '<:check:1458968004066017332>' : '<:dashy:1458967877796364546>'} **${q.name}**`,
    `> ${q.description}`,
    `-# **Progress:** ${cur} / ${max} ( ${pct}% )`,
    `-# **Rewards:** ${fmtRewards(q.rewards)}`,
  ].join('\n');
}

/* =========================
   Load assigned quests
========================= */

async function getAssigned(userId, category) {
  const assignment = await ensureAssigned(userId, category, 3);
  if (!assignment?.questKeys?.length) {
    return { assignment, quests: [] };
  }

  const quests = await Quest.find({
    key: { $in: assignment.questKeys },
  }).lean();

  return { assignment, quests };
}

/* =========================
   Main Command
========================= */

module.exports = {
  async execute(interaction, injected = {}) {
  const userId = interaction.user.id;

  const filter =
    injected.category ??
    interaction.options?.getString('category');

  const page =
    injected.page ??
    interaction.options?.getInteger('page') ??
    0;

    const PAGE_ORDER = ['daily', 'weekly', 'lifetime', 'event'];
    const category = filter ?? PAGE_ORDER[page] ?? 'daily';
    const now = new Date();

    let quests = [];

    let assignment = null;

if (category === 'daily') {
  const res = await getAssigned(userId, 'daily');
  assignment = res.assignment;
  quests = res.quests;
}

if (category === 'weekly') {
  const res = await getAssigned(userId, 'weekly');
  assignment = res.assignment;
  quests = res.quests;
}
    if (category === 'lifetime') quests = await Quest.find({ category: 'lifetime' }).lean();
    if (category === 'event') quests = await Quest.find({ category: 'event' }).lean();

    quests = quests.filter(q => !q.expiresAt || q.expiresAt > now);
    const PAGE_SIZE = 3;

let totalPages = 1;
let pagedQuests = quests;

if (['lifetime', 'event'].includes(category)) {
  totalPages = Math.max(1, Math.ceil(quests.length / PAGE_SIZE));
  const pageIndex = Math.min(page, totalPages - 1);
  pagedQuests = quests.slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE
  );
}
    /* =========================
       Ensure UserQuest rows
    ========================= */

    for (const q of quests) {
      await UserQuest.findOneAndUpdate(
        { userId, questKey: q.key },
        {
          $setOnInsert: {
            progress: 0,
            goal: q.conditions?.count ?? 0,
            completed: false,
            rewardClaimed: false,
          },
        },
        { upsert: true }
      );
    }

    const userQuests = await UserQuest.find({
      userId,
      questKey: { $in: quests.map(q => q.key) },
    }).lean();

    const uqMap = new Map(userQuests.map(x => [x.questKey, x]));

    /* =========================
       Completion quests scan
    ========================= */

    for (const q of quests) {
      if (q.mode !== 'completion') continue;

      const uq = await UserQuest.findOne({ userId, questKey: q.key });
      if (!uq) continue;

      const result = await checkCompletionProgress(userId, q);

      uq.progress = result.owned;
      uq.goal = result.total;

      if (result.completed && !uq.completed) {
        uq.completed = true;
        uq.completedAt = new Date();
        await uq.save();
        await rewards.completeQuest(userId, q);
      } else {
        await uq.save();
      }

      uqMap.set(q.key, uq.toObject());
    }

    /* =========================
       Build display
    ========================= */

    let resetLine = '';

if (['daily', 'weekly'].includes(category) && assignment?.resetAt) {
  const ts = Math.floor(new Date(assignment.resetAt).getTime() / 1000);
  resetLine = `-# **Resets:** <t:${ts}:R>`;
}

    const lines = pagedQuests.map(q => fmtQuest(q, uqMap.get(q.key)));

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({
  text: ['lifetime', 'event'].includes(category)
    ? `Category: ${category.toUpperCase()} • Page ${page + 1}`
    : `Category: ${category.toUpperCase()}`,
})
      .setDescription([
  '# Quests',
  resetLine,
  lines.join('\n\n') || 'No quests available.',
].filter(Boolean).join('\n'));

    /* =========================
       Pagination buttons
    ========================= */

    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: '• Previous',
            custom_id: `quest:list:${PAGE_ORDER.indexOf(category) - 1}`,
            disabled: PAGE_ORDER.indexOf(category) <= 0,
          },
          {
            type: 2,
            style: 2,
            label: 'Next •',
            custom_id: `quest:list:${PAGE_ORDER.indexOf(category) + 1}`,
            disabled: PAGE_ORDER.indexOf(category) >= PAGE_ORDER.length - 1,
          },
        ],
      },
    ];

    await interaction.editReply({
      embeds: [embed],
      components,
    });
  },
};