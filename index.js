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

// --- Define Test Schema ---
const userSchema = new mongoose.Schema({
  discordId: String,
  username: String,
  joinedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// --- On Bot Ready ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Test insert to DB
  const testUser = new User({
    discordId: '1234567890',
    username: 'TestUser'
  });

  await testUser.save();
  console.log("Test user saved to MongoDB");
});

// --- Login ---
client.login(process.env.TOKEN);