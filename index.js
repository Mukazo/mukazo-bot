// src/index.js
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

// Interaction handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    // ⛔ DO NOT enqueue workers here
    // ⛔ DO NOT decide logic here

    await interaction.deferReply(); // single defer, always
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

// MongoDB (main bot)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Main bot MongoDB connected'))
  .catch(console.error);

client.login(process.env.TOKEN);
