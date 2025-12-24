require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const path = require('path');
const { addJobToQueue } = require('./queue');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.commands = new Collection();

// Register your local commands (e.g., card)
const commandFiles = ['card.js']; // Add other command files as needed
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// On interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, addJobToQueue);
  } catch (err) {
    console.error(`[Bot] ❌ Error executing command ${interaction.commandName}:`, err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Something went wrong!' });
    } else {
      await interaction.reply({ content: 'Something went wrong!', ephemeral: true });
    }
  }
});

// Connect to MongoDB and login bot
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Bot] 🟢 Connected to MongoDB');

    await client.login(process.env.TOKEN);
    console.log('[Bot] 🟢 Logged in as', client.user.tag);
  } catch (err) {
    console.error('[Bot] ❌ Failed to start bot:', err);
  }
})();
