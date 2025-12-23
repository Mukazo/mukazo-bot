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
    invalidWebhook: false,

    inGuild() {
      return !!this.guildId;
    },

    isChatInputCommand() {
      return true;
    },

    async deferReply({ ephemeral } = {}) {
      this.deferred = true;
      const flags = ephemeral ? EPH_FLAG : undefined;

      if (!applicationId || !token) {
        console.warn('[remoteInteraction.deferReply] Missing applicationId or token');
        this.invalidWebhook = true;
        return false;
      }

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

      if (!applicationId || !token) {
        console.error('[remoteInteraction.reply] ❌ Missing applicationId or token', {
          applicationId,
          token
        });
        return false;
      }

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

      if (!applicationId || !token) {
        console.error('[remoteInteraction.editReply] ❌ Missing applicationId or token', {
          applicationId,
          token
        });
        return false;
      }

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

      if (!applicationId || !token) {
        console.error('[remoteInteraction.followUp] ❌ Missing applicationId or token', {
          applicationId,
          token
        });
        return false;
      }

      await rest.request({
        method: 'POST',
        path: Routes.webhook(applicationId, token),
        body: { flags, ...restData }
      });

      return true;
    },

    async fetchReply() {
      if (!applicationId || !token) {
        console.error('[remoteInteraction.fetchReply] ❌ Missing applicationId or token', {
          applicationId,
          token
        });
        return null;
      }

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

    options: buildOptionsProxy(
      optionsSnap || {
        subcommand: null,
        subcommandGroup: null,
        byName: {}
      }
    )
  };
}

module.exports = { createRemoteInteraction };
