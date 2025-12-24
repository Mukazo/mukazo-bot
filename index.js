// src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { enqueueInteraction } = require('./queue');

const RUN_LOCAL = new Set([
  'batch-create',
  'batch-edit'
]);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands', 'guild-only');
for (const file of fs.readdirSync(commandsPath)) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Handle interactions
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const sub = interaction.options.getSubcommand(false);
  const key = sub
    ? `${interaction.commandName}-${sub}`
    : interaction.commandName;

  // Defer early so workers never race the 3s timeout
  await interaction.deferReply();

  if (!RUN_LOCAL.has(key)) {
    await enqueueInteraction(key, {
      interactionId: interaction.id,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      options: interaction.options.data
    });
    return;
  }

  await command.execute(interaction);
});

// DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(console.error);

client.login(process.env.TOKEN);
