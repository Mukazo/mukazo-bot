const { EmbedBuilder } = require('discord.js');
const Quest = require('../../../models/Quest');
const UserQuest = require('../../../models/UserQuest');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');

function bar(c, m) {
  const size = 10;
  const fill = Math.min(size, Math.round((c / m) * size));
  return '█'.repeat(fill) + '░'.repeat(size - fill);
}

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const now = new Date();

    const progress = new Map(
      (await UserQuest.find({ userId })).map(q => [q.questKey, q])
    );

    const sections = [];

    async function add(cat, title) {
      let quests = [];
      if (['daily', 'weekly'].includes(cat)) {
        const a = await UserQuestAssignment.findOne({ userId, category: cat });
        if (!a) return;
        quests = await Quest.find({ key: { $in: a.questKeys } });
      } else {
        quests = await Quest.find({ category: cat });
      }

      quests = quests.filter(q => !q.expiresAt || q.expiresAt > now);
      if (!quests.length) return;

      const lines = quests.map(q => {
        const uq = progress.get(q.key);
        if (q.mode === 'completion') {
          return `${uq?.completed ? '✅' : '⬜'} **${q.name}**\n${q.description}`;
        }
        const cur = uq?.progress || 0;
        return `${uq?.completed ? '✅' : '🟦'} **${q.name}**\n${bar(cur, q.conditions.count)} ${cur}/${q.conditions.count}`;
      });

      sections.push(`### **${title}**\n${lines.join('\n\n')}`);
    }

    await add('daily', 'Daily');
    await add('weekly', 'Weekly');
    await add('lifetime', 'Lifetime');
    await add('event', 'Event');

    const embed = new EmbedBuilder()
      .setTitle('Quests')
      .setDescription(sections.join('\n\n') || 'No quests available.');

    await interaction.editReply({ embeds: [embed] });
  },
};
