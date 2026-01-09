const User = require('../../../models/User');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');
const { ensureAssigned } = require('../../../utils/quest/assign');

const REROLL_COST = 1500; // change to whatever you want

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const category = interaction.options.getString('category'); // daily/weekly
    const questName = interaction.options.getString('quest');

    const user = await User.findOne({ userId }).lean();
    const balance = Number(user?.wirlies || 0);

    if (balance < REROLL_COST) {
      return interaction.editReply({ content: `You need <:Wirlies:1455924065972785375> ${REROLL_COST} to reroll.` });
    }

    // deduct
    await User.updateOne({ userId }, { $inc: { wirlies: -REROLL_COST } }, { upsert: true });

    const Quest = require('../../../models/Quest');
const UserQuest = require('../../../models/UserQuest');

const assignment = await UserQuestAssignment.findOne({ userId, category });
if (!assignment?.questKeys?.length) {
  return interaction.editReply({ content: 'No quests to reroll.' });
}

// find quest by name INSIDE assignment
const quest = await Quest.findOne({
  key: { $in: assignment.questKeys },
  name: new RegExp(`^${questName}$`, 'i'),
}).lean();

if (!quest) {
  return interaction.editReply({ content: 'That quest is not in your list.' });
}

// remove quest from assignment
assignment.questKeys = assignment.questKeys.filter(k => k !== quest.key);
await assignment.save();

// remove its progress row
await UserQuest.deleteOne({ userId, questKey: quest.key });

// assign ONE replacement
await ensureAssigned(userId, category, 3);
    
    return interaction.editReply({ content: `Rerolled **${quest.name}** quests for <:Wirlies:1455924065972785375> ${REROLL_COST}.` });
  },
};
