require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection, InteractionType, Partials } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const handleButton = require('./handlers/buttons');
const { EmbedBuilder } = require('discord.js');
const Maintenance = require('./models/Maintenance');
const User = require('./models/User');
const MAINTENANCE_BYPASS_ROLE_ID = '1455908485425397842';


function buildMaintenanceEmbed(maintenance) {
  return new EmbedBuilder()
    .setColor('#f59e0b')
    .setDescription(
      [
        '## Mukazo undergoes maintenance . . .',
        '> In the meantime, go take a relaxing break!',
        '',
        maintenance.reason
          ? `**Reason:** ${maintenance.reason}`
          : '**Reason:** Ongoing maintenance.',
        maintenance.endsAt
          ? `**Estimated completion:** <t:${Math.floor(
              new Date(maintenance.endsAt).getTime() / 1000
            )}:R>`
          : '**Estimated completion:** Unknown',
      ].join('\n')
    );
}



const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

client.commands = new Collection();

// Load commands
const commandFolders = ['global', 'guild-only'];

for (const folder of commandFolders) {
  const commandsPath = path.join(__dirname, 'commands', folder);
  if (!fs.existsSync(commandsPath)) continue;

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
  }
}


/* ===========================
   SLASH COMMAND HANDLER
=========================== */
client.on(Events.InteractionCreate, async interaction => {

  const maintenance = await Maintenance.findOne();

const hasBypassRole =
  interaction.inGuild() &&
  interaction.member?.roles?.cache?.has(MAINTENANCE_BYPASS_ROLE_ID);

if (maintenance?.active && !hasBypassRole) {
  return interaction.reply({
    embeds: [buildMaintenanceEmbed(maintenance)],
  });
}

if (interaction.commandName !== 'start') {
      const userExists = await User.exists({ userId: interaction.user.id });
      if (!userExists) {
        return interaction.reply({ content: 'Welcome to Mukazo! Make sure you finish \`/start\` completely before using any other commands.' });
      }
    }


  /* ===========================
     AUTOCOMPLETE HANDLER
  =========================== */
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error('Autocomplete error:', err);
    }
    return;
  }

  /* ===========================
     SLASH COMMANDS
  =========================== */
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const ephemeral = command.ephemeral === true;

    try {
      await interaction.deferReply({ephemeral});
      await command.execute(interaction);
    } catch (err) {
      console.error(err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
      } else {
        await interaction.editReply('Something went wrong.');
      }
    }

    return;
  }

  /* ===========================
     BUTTONS (GLOBAL, RESTART-SAFE)
  =========================== */
  if (interaction.isButton()) {
    const handled = await handleButton(interaction);
    if (handled) return;
  }

  // other interaction types can go here later
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
      content: `\`${cardCode}\` assigned to batch: \`${selected}\``,
      components: [],
    });
  } catch (err) {
    console.error(err);
    await interaction.editReply({
      content: `Failed to assign batch: ${err.message}`,
      components: [],
    });
  }
});

// MongoDB (main bot)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Main bot MongoDB connected'))
  .catch(console.error);

client.login(process.env.TOKEN);
