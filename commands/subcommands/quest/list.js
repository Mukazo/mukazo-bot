const { EmbedBuilder } = require('discord.js');
const Quest = require('../../../models/Quest');
const UserQuest = require('../../../models/UserQuest');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');
const { ensureAssigned } = require('../../../utils/quest/assign');
const { checkCompletionProgress } = require('../../../utils/quest/completion');
const rewards = require('../../../utils/quest/rewards');

function bar(cur, max) {
  const size = 10;
  const fill = max > 0 ? Math.min(size, Math.round((cur / max) * size)) : 0;
  return '█'.repeat(fill) + '░'.repeat(size - fill);
}

function fmtQuest(q, uq) {
  if (q.mode === 'completion') {
    const cur = uq?.progress ?? 0;
    const max = uq?.goal ?? 0;
    const pct = max > 0 ? Math.floor((cur / max) * 100) : 0;

    return [
      `${uq?.completed ? '✅' : '❌'} **${q.name}**`,
      q.description,
      max > 0 ? `Progress: ${cur}/${max} (${pct}%)` : `Progress: 0/0 (0%)`,
    ].join('\n');
  }

  const cur = uq?.progress ?? 0;
  const max = uq?.goal ?? (q.conditions?.count ?? 0);
  return [
    `${uq?.completed ? '✅' : '❌'} **${q.name}**`,
    q.description,
    `${bar(cur, max)} ${cur}/${max}`,
  ].join('\n');
}

async function getDailyWeeklyAssigned(userId, category) {
  await ensureAssigned(userId, category, 3);
  const a = await UserQuestAssignment.findOne({ userId, category }).lean();
  if (!a?.questKeys?.length) return [];
  return Quest.find({ key: { $in: a.questKeys } }).lean();
}

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const filter = interaction.options.getString('category');
    const now = new Date();

    const sections = [];

    async function loadSection(title, quests) {
      const active = quests.filter(q => !q.expiresAt || q.expiresAt > now);
      if (!active.length) return;

      // Ensure UserQuest docs exist
      for (const q of active) {
        await UserQuest.findOneAndUpdate(
          { userId, questKey: q.key },
          { $setOnInsert: { progress: 0, goal: 0, completed: false, rewardClaimed: false } },
          { upsert: true }
        );
      }

      // Pull user quest docs
      const uqs = await UserQuest.find({ userId, questKey: { $in: active.map(q => q.key) } }).lean();
      const uqMap = new Map(uqs.map(x => [x.questKey, x]));

      // Re-evaluate completion quests (inventory scan) and auto reward
      for (const q of active) {
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

      const lines = active.map(q => fmtQuest(q, uqMap.get(q.key)));
      sections.push(`## ${title}\n${lines.join('\n\n')}`);
    }

    if (!filter || filter === 'daily') {
      await loadSection('Daily', await getDailyWeeklyAssigned(userId, 'daily'));
    }
    if (!filter || filter === 'weekly') {
      await loadSection('Weekly', await getDailyWeeklyAssigned(userId, 'weekly'));
    }
    if (!filter || filter === 'lifetime') {
      const lifetime = await Quest.find({ category: 'lifetime' }).lean();
      await loadSection('Lifetime', lifetime);
    }
    if (!filter || filter === 'event') {
      const event = await Quest.find({ category: 'event' }).lean();
      await loadSection('Event', event);
    }

    const embed = new EmbedBuilder()
      .setTitle('Quests')
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription(sections.join('\n\n') || 'No quests available.');

    await interaction.editReply({ embeds: [embed] });
  },
};
