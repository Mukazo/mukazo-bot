const User = require('../../../models/User');
const Quest = require('../../../models/Quest');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');
const UserQuest = require('../../../models/UserQuest');

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const category = interaction.options.getString('category');
    const slot = interaction.options.getInteger('slot') - 1;

    const COST = 500; // example cost, you can tweak

const user = await User.findOne({ userId });
if (!user || (user.wirlies || 0) < COST) {
  return interaction.editReply({
    content: `You need **${COST} Wirlies** to reroll a quest.`,
  });
}

    const assignment = await UserQuestAssignment.findOne({ userId, category });
    if (!assignment || !assignment.questKeys[slot]) {
      return interaction.editReply({ content: 'Invalid slot.' });
    }

    const pool = await Quest.find({ category }).lean();
    const replacement = pool.find(q => !assignment.questKeys.includes(q.key));
    if (!replacement) {
      return interaction.editReply({ content: 'No replacement available.' });
    }

    user.wirlies -= COST;
await user.save();

    assignment.questKeys[slot] = replacement.key;
    await assignment.save();

    await UserQuest.deleteOne({ userId, questKey: replacement.key });

    await interaction.editReply({
      content: `✅ Rerolled quest. New quest: **${replacement.name}**`,
    });
  },
};
