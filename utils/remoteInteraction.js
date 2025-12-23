const { WebhookClient } = require('discord.js');
const { buildOptionsProxy } = require('./optionsProxy');

const EPH_FLAG = 1 << 6;

function createRemoteInteraction({ appId, token, channelId, guildId, optionsSnap, userSnap }) {
  const wh = new WebhookClient({ id: appId, token });

  return {
    applicationId: appId,
    channelId,
    guildId: guildId ?? null,
    guild: guildId ? { id: guildId } : null,
    user: userSnap || { id: '0' },

    inGuild() { return !!this.guildId; },
    inCachedGuild() { return !!this.guildId; },
    isRepliable: () => true,
    isChatInputCommand: () => true, // makes interaction.isChatInputCommand() work

    deferred: false,
    replied: false,

    async reply(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;
      this.replied = true;
      return wh.send({ flags, ...rest });
    },

    async deferReply({ ephemeral } = {}) {
      const flags = ephemeral ? EPH_FLAG : undefined;
      this.deferred = true;
      return wh.send({ content: '⏳ Processing...', flags });
    },

    async followUp(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;
      return wh.send({ flags, ...rest });
    },

    async editReply(data = {}) {
      const { ephemeral, ...rest } = data;
      const flags = ephemeral ? EPH_FLAG : rest.flags;
      return wh.editMessage('@original', { flags, ...rest });
    },

    async fetchReply() {
      try { return await wh.fetchMessage('@original'); } catch { return null; }
    },

    options: buildOptionsProxy(optionsSnap || {
      subcommand: null,
      subcommandGroup: null,
      byName: {}
    }),

    channel: {
      send: (data) => wh.send(data)
    }
  };
}

module.exports = { createRemoteInteraction };
