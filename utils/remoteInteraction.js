const { REST, Routes } = require('discord.js');
const { buildOptionsProxy } = require('./optionsProxy');

const EPH_FLAG = 1 << 6;

function createRemoteInteraction({ appId, token, channelId, guildId, optionsSnap, userSnap }) {
  const rest = new REST({ version: '10' }).setToken(token); // ✅ token from payload

  return {
    applicationId: appId,
    channelId,
    guildId: guildId ?? null,
    guild: guildId ? { id: guildId } : null,
    user: userSnap || { id: '0' },

    replied: false,
    deferred: false,

    inGuild() { return !!this.guildId; },
    inCachedGuild() { return !!this.guildId; },
    isRepliable: () => true,
    isChatInputCommand: () => true,

    async deferReply({ ephemeral } = {}) {
      const flags = ephemeral ? EPH_FLAG : undefined;
      this.deferred = true;

      // ✅ Use Routes.webhookMessage for @original
      return rest.post(
        Routes.webhookMessage(appId, token, '@original'),
        { body: { content: '⏳ Processing...', flags } }
      );
    },

    async reply(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;
      this.replied = true;

      return rest.post(
        Routes.webhook(appId, token),
        { body: { flags, ...rest } }
      );
    },

    async editReply(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;

      return rest.patch(
        Routes.webhookMessage(appId, token, '@original'),
        { body: { flags, ...rest } }
      );
    },

    async followUp(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;

      return rest.post(
        Routes.webhook(appId, token),
        { body: { flags, ...rest } }
      );
    },

    async fetchReply() {
      try {
        return await rest.get(Routes.webhookMessage(appId, token, '@original'));
      } catch {
        return null;
      }
    },

    options: buildOptionsProxy(optionsSnap || {
      subcommand: null,
      subcommandGroup: null,
      byName: {},
    }),
  };
}

module.exports = { createRemoteInteraction };
