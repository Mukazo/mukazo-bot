const { EmbedBuilder } = require('discord.js');
const Quest = require('../../../models/Quest');
const UserQuest = require('../../../models/UserQuest');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');
const { ensureAssigned } = require('../../../utils/quest/assign');
const completion = require('../../../utils/quest/completion');
const rewards = require('../../../utils/quest/rewards');

function bar(cur, max) {
  const size = 10;
  if (max <= 0) return '░'.repeat(size);
  const fill = Math.min(size, Math.round((cur / max) * size));
  return '█'.repeat(fill) + '░'.repeat(size - fill);
}

function fmtQuest(q, uq) {
  // COMPLETION QUESTS
  if (q.mode === 'completion') {
    const cur = uq?.progress ?? 0;
    const max = uq?.goal ?? 0;
    const pct = max > 0 ? Math.floor((cur / max) * 100) : 0;

    return [
      `${uq?.completed ? '<:check:1458968004066017332>' : '<:dashy:1458967877796364546>'} **${q.name}**`,
      q.description,
      max > 0
        ? `Progress: ${cur}/${max} (${pct}%)`
        : `Progress: Calculating…`,
    ].join('\n');
  }

  // COUNT / COMMAND QUESTS
  const cur = uq?.progress || 0;
  const max = q.conditions?.count || 0;

  return [
    `${uq?.completed ? '<:check:1458968004066017332>' : '<:dashy:1458967877796364546>'} **${q.name}**`,
    q.description,
    `${bar(cur, max)} ${cur}/${max}`,
  ].join('\n');
}

async function getAssigned(userId, category) {
  await ensureAssigned(userId, category, 3);

  const assignment = await UserQuestAssignment.findOne({ userId, category }).lean();
  if (!assignment) return [];

  const quests = await Quest.find({ key: { $in: assignment.questKeys } }).lean();

  // Ensure UserQuest rows exist
  for (const q of quests) {
    await UserQuest.findOneAndUpdate(
      { userId, questKey: q.key },
      {
        $setOnInsert: {
          progress: 0,
          goal: 0,
          completed: false,
        },
      },
      { upsert: true }
    );
  }

  // 🔥 Re-evaluate completion quests EVERY time list is opened
  for (const q of quests) {
    if (q.mode !== 'completion') continue;

    const uq = await UserQuest.findOne({ userId, questKey: q.key });
    if (!uq) continue;

    const result = await completion.checkCompletion(userId, q);

    uq.progress = result.owned;
    uq.goal = result.total;

    if (result.completed && !uq.completed) {
      uq.completed = true;
      uq.completedAt = new Date();

      // 🎁 Grant rewards immediately
      await rewards.completeQuest(userId, q);

      console.log('[QUEST] Completion quest auto-completed + rewarded:', q.key);
    }

    await uq.save();
  }

  return quests;
}

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const filter = interaction.options.getString('category');
    const now = new Date();

    const userQuests = await UserQuest.find({ userId }).lean();
    const map = new Map(userQuests.map(x => [x.questKey, x]));

    const sections = [];

    async function addSection(title, quests) {
      const active = quests.filter(q => !q.expiresAt || q.expiresAt > now);
      if (!active.length) return;

      const lines = active.map(q => fmtQuest(q, map.get(q.key)));
      sections.push(`### **__${title}__**\n${lines.join('\n\n')}`);
    }

    if (!filter || filter === 'daily') {
      await addSection('Daily', await getAssigned(userId, 'daily'));
    }
    if (!filter || filter === 'weekly') {
      await addSection('Weekly', await getAssigned(userId, 'weekly'));
    }
    if (!filter || filter === 'lifetime') {
      const lifetime = await Quest.find({ category: 'lifetime' }).lean();
      await addSection('Lifetime', lifetime);
    }
    if (!filter || filter === 'event') {
      const event = await Quest.find({ category: 'event' }).lean();
      await addSection('Event', event);
    }

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '# Quests',
        sections.join('\n') || 'No quests available.',
      ].join('\n'));

    await interaction.editReply({ embeds: [embed] });
  },
};
