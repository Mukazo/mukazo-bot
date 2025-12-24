const { REST, Routes } = require('discord.js');
const getOrCreateUser = require('./getOrCreateUser');

function makeRolesCache(roleIds = []) {
  const set = new Set(roleIds);
  return {
    has: (id) => set.has(id),
    forEach: (fn) => { for (const id of set) fn({ id }, id); },
    get size() { return set.size; }
  };
}

async function hydrateGuildMember(interaction) {
  if (!interaction.guildId || !interaction.user?.id) return null;
  try {
    const rest = new REST({ version: '10' }).setToken(interaction.token);
    const data = await rest.get(Routes.guildMember(interaction.guildId, interaction.user.id));
    const cache = makeRolesCache(data.roles || []);
    interaction.member = { user: interaction.user, roles: { cache } };
    return interaction.member;
  } catch {
    const fallbackRoles = interaction.memberRoles || [];
interaction.member = {
  user: interaction.user,
  roles: { cache: makeRolesCache(fallbackRoles) }
};

    return interaction.member;
  }
}

function addShims(interaction) {
  if (!interaction.inGuild) interaction.inGuild = function () { return !!this.guildId; };
  if (!interaction.inCachedGuild) interaction.inCachedGuild = function () { return !!this.guildId; };
  if (!interaction.isRepliable) interaction.isRepliable = () => true;
}

function attachResponseMethods(interaction) {
  const applicationId = interaction.applicationId ?? interaction.appId;
  if (!applicationId || !interaction.token) {
    console.error('[hydrate] ❌ Missing applicationId or token:', { applicationId, token: interaction.token });
    return;
  }

  const rest = new REST({ version: '10' }).setToken(interaction.token);
  const webhookRoute = Routes.webhook(applicationId, interaction.token);

  interaction.deferReply = (options = {}) =>
  rest.post(webhookRoute, {
    body: {
      ...options,
      type: 5 // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    }
  });


  interaction.editReply = (data) =>
    rest.patch(`${webhookRoute}/messages/@original`, { body: data });

  interaction.followUp = (data) =>
    rest.post(`${webhookRoute}`, { body: data });

  interaction.replied = false;
  interaction.deferred = false;
}

async function hydrateWorkerInteraction(interaction) {
  addShims(interaction);
  attachResponseMethods(interaction);

  try {
    interaction.userData = await getOrCreateUser(interaction);
  } catch (e) {
    console.warn('[hydrate] getOrCreateUser failed:', e?.message || e);
  }

  await hydrateGuildMember(interaction);
  return interaction;
}

module.exports = { hydrateWorkerInteraction };
