// utils/remoteInteraction.js
const { REST, Routes } = require('discord.js');
const { buildOptionsProxy } = require('./optionsProxy');

const EPH_FLAG = 1 << 6;

function createRemoteInteraction({ appId, token, channelId, guildId, optionsSnap, userSnap }) {
  // Token must be the interaction token
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

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

      return rest.request({
        method: 'POST',
        path: Routes.interactionCallback(this.applicationId, token),
        body: {
          type: 5, // DEFERRED_RESPONSE
          data: { flags }
        }
      });
    },

    async reply(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;

      this.replied = true;

      return rest.request({
        method: 'POST',
        path: Routes.webhook(this.applicationId, token),
        body: { flags, ...restData }
      });
    },

    async editReply(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;

      return rest.request({
        method: 'PATCH',
        path: Routes.webhookMessage(this.applicationId, token, '@original'),
        body: { flags, ...restData }
      });
    },

    async followUp(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;

      return rest.request({
        method: 'POST',
        path: Routes.webhook(this.applicationId, token),
        body: { flags, ...restData }
      });
    },

    async fetchReply() {
      try {
        return rest.request({
          method: 'GET',
          path: Routes.webhookMessage(this.applicationId, token, '@original'),
        });
      } catch {
        return null;
      }
    },

    options: buildOptionsProxy(optionsSnap || {
      subcommand: null,
      subcommandGroup: null,
      byName: {}
    })
  };
}

module.exports = { createRemoteInteraction };
