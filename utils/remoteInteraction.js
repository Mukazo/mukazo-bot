const { REST } = require('@discordjs/rest');
const { Routes, RouteBases } = require('discord.js');
const { buildOptionsProxy } = require('./optionsProxy');

const EPH_FLAG = 1 << 6;

function createRemoteInteraction({ appId, token, channelId, guildId, optionsSnap, userSnap }) {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  const messageUrl = `${RouteBases.api}/webhooks/${appId}/${token}/messages/@original`;
  const webhookUrl = `${RouteBases.api}/webhooks/${appId}/${token}`;

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

    async reply(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;
      this.replied = true;

      return rest.post(webhookUrl, {
        body: { flags, ...rest },
      });
    },

    async editReply(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;

      return rest.patch(messageUrl, {
        body: { flags, ...rest },
      });
    },

    async followUp(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;

      return rest.post(webhookUrl, {
        body: { flags, ...rest },
      });
    },

    async fetchReply() {
      try {
        return await rest.get(messageUrl);
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
