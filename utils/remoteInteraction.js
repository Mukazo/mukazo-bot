const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const { buildOptionsProxy } = require('./optionsProxy');

const EPH_FLAG = 1 << 6;

function createRemoteInteraction({ appId, token, channelId, guildId, optionsSnap, userSnap }) {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  const applicationId = appId;

  return {
    applicationId,
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
  this.deferred = true;
  const flags = ephemeral ? EPH_FLAG : undefined;

  try {
    await rest.request({
      method: 'POST',
      path: Routes.interactionCallback(applicationId, token),
      body: {
        type: 5,
        data: { flags }
      }
    });
    return true;
  } catch (err) {
    if (err.code === 10015) {
      console.warn('[Webhook] ❌ Unknown Webhook — expired token');
      this.invalidWebhook = true;
      return false;
    }
    throw err;
  }
},


    async reply(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;
      this.replied = true;

      await rest.request({
        method: 'POST',
        path: Routes.webhook(applicationId, token),
        body: { flags, ...restData }
      });
      return true;
    },

    async editReply(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;

      await rest.request({
        method: 'PATCH',
        path: Routes.webhookMessage(applicationId, token, '@original'),
        body: { flags, ...restData }
      });
      return true;
    },

    async followUp(data = {}) {
      const { ephemeral, ...restData } = data;
      const flags = ephemeral ? EPH_FLAG : restData.flags;

      await rest.request({
        method: 'POST',
        path: Routes.webhook(applicationId, token),
        body: { flags, ...restData }
      });
      return true;
    },

    async fetchReply() {
      try {
        await rest.request({
          method: 'GET',
          path: Routes.webhookMessage(applicationId, token, '@original')
        });
      return true;
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
