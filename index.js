require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { enqueueInteraction } = require('./queue'); // if index.js is inside src/
const RUN_LOCAL = new Set(['card create', 'card edit', 'batch create', 'batch edit']); // tiny/fast ones only

// --- Setup Bot ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// --- Add a collection to store slash commands ---
client.commands = new Collection();

// --- Load Commands ---
const commandsPath = path.join(__dirname, 'commands', 'guild-only');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  }
}

// --- Handle Slash Commands ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!RUN_LOCAL.has(interaction.commandName)) {
        await enqueueInteraction(interaction);         // worker will send the ONLY visible message
        return;                                        // do NOT send any local message
      }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Command failed:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Something went wrong!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Something went wrong!', ephemeral: true });
    }
  }
});

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("✅ Connected to MongoDB via Mongoose");
})
.catch((err) => {
  console.error("❌ MongoDB connection error:", err);
});

// --- On Bot Ready ---
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// --- Login Bot ---
client.login(process.env.TOKEN);