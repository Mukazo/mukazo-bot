const { REST, Routes } = require('discord.js');
const getOrCreateUser = require('./getOrCreateUser');

function makeRolesCache(roleIds = []) {
  const set = new Set(roleIds);
  return {
    has(id) { return set.has(id); },
    forEach(fn) { for (const id of set) fn({ id }, id); },
    get size() { return set.size; }
  };
}

async function hydrateGuildMember(interaction) {
  if (!interaction.guildId || !interaction.user?.id) return null;

  try {
    const rest = new REST({ version: '10' }).setToken(interaction.token);
    const data = await rest.get(Routes.guildMember(interaction.guildId, interaction.user.id));
    interaction.member = { user: interaction.user, roles: { cache: makeRolesCache(data.roles || []) } };
    return interaction.member;
  } catch {
    interaction.member = { user: interaction.user, roles: { cache: makeRolesCache([]) } };
    return interaction.member;
  }
}

function attachResponseMethods(interaction) {
  const rest = new REST({ version: '10' }).setToken(interaction.token);

  const applicationId = interaction.applicationId ?? interaction.appId;
  if (!applicationId) {
    console.error('[hydrate] ⚠️ Missing applicationId on interaction!', interaction);
  }

  const webhookBase = Routes.webhook(applicationId, interaction.token);

  interaction.deferReply = (options = {}) =>
    rest.post(`${webhookBase}/messages/@original`, {
      body: { ...options, type: 5 } // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

  interaction.editReply = (data) =>
    rest.patch(`${webhookBase}/messages/@original`, { body: data });

  interaction.followUp = (data) =>
    rest.post(`${webhookBase}`, { body: data });
}

async function hydrateWorkerInteraction(interaction) {
  // Attach REST response methods
  attachResponseMethods(interaction);

  // Attempt to fetch member info
  try {
    interaction.userData = await getOrCreateUser(interaction);
  } catch (e) {
    console.warn('[hydrate] getOrCreateUser failed:', e?.message || e);
  }

  await hydrateGuildMember(interaction);

  return interaction;
}

module.exports = { hydrateWorkerInteraction };
