// utils/remoteInteraction.js
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const { buildOptionsProxy } = require('./optionsProxy');

const EPH_FLAG = 1 << 6;

function createRemoteInteraction({ appId, token, channelId, guildId, optionsSnap, userSnap }) {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  return {
    applicationId: appId,
    token,
    channelId,
    guildId: guildId || null,
    guild: guildId ? { id: guildId } : null,
    user: userSnap || { id: '0' },

    replied: false,
    deferred: false,

    inGuild() { return !!this.guildId; },
    isChatInputCommand() { return true; },

    async deferReply({ ephemeral } = {}) {
      // This triggers the original interaction callback
      this.deferred = true;
      const flags = ephemeral ? EPH_FLAG : undefined;

      return rest.request({
        method: 'POST',
        path: Routes.interactionCallback(this.applicationId, this.token),
        body: {
          type: 5,
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
        path: Routes.webhook(this.applicationId, this.token),
        body: { flags, ...restData }
      });
    },

    async editReply(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;

      return rest.request({
        method: 'PATCH',
        path: Routes.webhookMessage(this.applicationId, this.token, '@original'),
        body: { flags, ...restData }
      });
    },

    async followUp(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;

      return rest.request({
        method: 'POST',
        path: Routes.webhook(this.applicationId, this.token),
        body: { flags, ...restData }
      });
    },

    async fetchReply() {
      try {
        return rest.request({
          method: 'GET',
          path: Routes.webhookMessage(this.applicationId, this.token, '@original')
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
