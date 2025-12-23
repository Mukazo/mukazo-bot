const { REST } = require('@discordjs/rest');
const { buildOptionsProxy } = require('./optionsProxy');

const EPH_FLAG = 1 << 6;

function createRemoteInteraction({ appId, token, channelId, guildId, optionsSnap, userSnap }) {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  // Base URLs
  const baseWebhook = `/webhooks/${appId}/${token}`;
  const originalMessage = `${baseWebhook}/messages/@original`;

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
        path: baseWebhook,
        body: {
          content: '⏳ Processing...',
          flags,
        },
      });
    },

    async reply(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;
      this.replied = true;
      return rest.request({
        method: 'POST',
        path: baseWebhook,
        body: { flags, ...restData },
      });
    },

    async editReply(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;
      return rest.request({
        method: 'PATCH',
        path: originalMessage,
        body: { flags, ...restData },
      });
    },

    async followUp(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;
      return rest.request({
        method: 'POST',
        path: baseWebhook,
        body: { flags, ...restData },
      });
    },

    async fetchReply() {
      try {
        return await rest.request({
          method: 'GET',
          path: originalMessage,
        });
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
