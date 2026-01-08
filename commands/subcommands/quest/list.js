const { EmbedBuilder } = require('discord.js');
const Quest = require('../../../models/Quest');
const UserQuest = require('../../../models/UserQuest');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');
const { ensureAssigned } = require('../../../utils/quest/assign');

function bar(cur, max) {
  const size = 10;
  const fill = max > 0 ? Math.min(size, Math.round((cur / max) * size)) : 0;
  return '█'.repeat(fill) + '░'.repeat(size - fill);
}

function fmtQuest(q, uq) {
  if (q.mode === 'completion') {
    return `${uq?.completed ? '✅' : '⬜'} **${q.name}**\n${q.description}`;
  }

  const cur = uq?.progress || 0;
  const max = q.conditions?.count || 0;
  return `${uq?.completed ? '✅' : '🟦'} **${q.name}**\n${q.description}\n${bar(cur, max)} ${cur}/${max}`;
}

async function getAssigned(userId, category) {
  await ensureAssigned(userId, category, 3);
  const a = await UserQuestAssignment.findOne({ userId, category }).lean();
  if (!a) return [];
  return Quest.find({ key: { $in: a.questKeys } }).lean();
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
      .setTitle('Quests')
      .setDescription(sections.join('\n\n') || 'No quests available.');

    await interaction.editReply({ embeds: [embed] });
  },
};
