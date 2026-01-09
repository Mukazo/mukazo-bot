const User = require('../../../models/User');
const UserQuestAssignment = require('../../../models/UserQuestAssignment');
const { ensureAssigned } = require('../../../utils/quest/assign');

const REROLL_COST = 1500; // change to whatever you want

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const category = interaction.options.getString('category'); // daily/weekly

    const user = await User.findOne({ userId }).lean();
    const balance = Number(user?.wirlies || 0);

    if (balance < REROLL_COST) {
      return interaction.editReply({ content: `You need <:Wirlies:1455924065972785375> ${REROLL_COST} to reroll.` });
    }

    // deduct
    await User.updateOne({ userId }, { $inc: { wirlies: -REROLL_COST } }, { upsert: true });

    // wipe assignment for category (forces new pick)
    await UserQuestAssignment.deleteOne({ userId, category });

    // reassign
    await ensureAssigned(userId, category, 3);

    return interaction.editReply({ content: `Rerolled **${category}** quests for <:Wirlies:1455924065972785375> ${REROLL_COST}.` });
  },
};
