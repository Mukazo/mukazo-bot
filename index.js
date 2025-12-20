require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const mongoose = require('mongoose');

// --- Setup Bot ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("Connected to MongoDB via Mongoose");
})
.catch((err) => {
  console.error("MongoDB connection error:", err);
});

// --- On Bot Ready ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// --- Login ---
client.login(process.env.TOKEN);