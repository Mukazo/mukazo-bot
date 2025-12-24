require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands', 'guild-only');
for (const file of fs.readdirSync(commandsPath)) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

/* ===========================
   SLASH COMMAND HANDLER
=========================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await interaction.deferReply(); // ✅ slash commands only
    await command.execute(interaction);
  } catch (err) {
    console.error(err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    } else {
      await interaction.editReply('Something went wrong.');
    }
  }
});

/* ===========================
   BATCH SELECT MENU HANDLER
=========================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith('batch:')) return;

   const parts = interaction.customId.split(':');

  const cardCode = parts.pop();              // ✅ ALWAYS correct
  const jobId = parts.slice(1).join(':');    // kept if you want it later
  const selected = interaction.values[0]; // 'null' or batch code

  await interaction.deferUpdate(); // ✅ correct for components

  try {
    const Card = require('./models/Card');
    const Batch = require('./models/Batch');

    let deactivateAt = null;

    if (selected !== 'null') {
      const batch = await Batch.findOne({ code: selected }).lean();
      if (!batch) throw new Error('Batch not found');
      deactivateAt = batch.deactivateCardsAt ?? null;
    }

    await Card.updateOne(
      { cardCode },
      {
        batch: selected === 'null' ? null : selected,
        deactivateAt,
      }
    );

    await interaction.editReply({
      content: `✅ Card \`${cardCode}\` assigned to batch: \`${selected}\``,
      components: [],
    });
  } catch (err) {
    console.error(err);
    await interaction.editReply({
      content: `❌ Failed to assign batch: ${err.message}`,
      components: [],
    });
  }
});

// MongoDB (main bot)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Main bot MongoDB connected'))
  .catch(console.error);

client.login(process.env.TOKEN);
