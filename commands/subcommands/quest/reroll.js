const User = require('../../../models/User');
const Quest = require('../../../models/Quest');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');
const UserQuest = require('../../../models/UserQuest');
const { ensureAssigned } = require('../../../utils/quest/assign');

const REROLL_COST_WIRLIES = 250; // change this

function pickReplacement(pool, currentKeys) {
  const available = pool.filter(q => !currentKeys.includes(q.key));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const category = interaction.options.getString('category'); // daily/weekly
    const slot = interaction.options.getInteger('slot') - 1; // 0-based

    if (category !== 'daily' && category !== 'weekly') {
      return interaction.editReply({ content: '❌ Only daily/weekly can be rerolled.' });
    }

    await ensureAssigned(userId, category, 3);

    const user = await User.findOne({ userId });
    const wirlies = user?.wirlies ?? 0;

    if (!user || wirlies < REROLL_COST_WIRLIES) {
      return interaction.editReply({
        content: `❌ You need **${REROLL_COST_WIRLIES} Wirlies** to reroll.`,
      });
    }

    const assignment = await UserQuestAssignment.findOne({ userId, category });
    if (!assignment || !assignment.questKeys[slot]) {
      return interaction.editReply({ content: '❌ Invalid quest slot.' });
    }

    const now = new Date();
    const pool = await Quest.find({
      category,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean();

    const replacement = pickReplacement(pool, assignment.questKeys);
    if (!replacement) {
      return interaction.editReply({ content: '❌ No replacement quests available right now.' });
    }

    // Deduct wirlies
    user.wirlies -= REROLL_COST_WIRLIES;
    await user.save();

    assignment.questKeys[slot] = replacement.key;
    await assignment.save();

    // Reset progress for that new quest key
    await UserQuest.deleteOne({ userId, questKey: replacement.key });

    await interaction.editReply({
      content: `✅ Rerolled slot **${slot + 1}**.\nNew quest: **${replacement.name}**\nCost: **${REROLL_COST_WIRLIES} Wirlies**`,
    });
  },
};
