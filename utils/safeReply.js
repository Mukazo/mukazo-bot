// utils/safeReply.js — safe helpers that avoid crashing workers

const EPH_FLAG = 1 << 6;
const TRANSIENT = new Set([10062, 40060, 10015, 'InteractionAlreadyReplied']);

const isComponent = (i) => i?.isButton?.() || i?.isStringSelectMenu?.() || false;
const codeOf = (e) => e?.code || e?.rawError?.code || e?.status;

/**
 * Safe defer, but only on real Discord interaction objects (bot only).
 */
async function safeDefer(interaction, { ephemeral = false } = {}) {
  // 🛑 Skip if this is not a real Discord interaction (i.e., worker context)
  if (typeof interaction?.deferReply !== 'function') return false;

  const flags = ephemeral ? EPH_FLAG : undefined;
  try {
    if (interaction.deferred || interaction.replied) return true;

    if (interaction.isChatInputCommand?.() || interaction.isModalSubmit?.()) {
      await interaction.deferReply({ flags });
      return true;
    }

    if (isComponent(interaction)) {
      await interaction.deferUpdate();
      return true;
    }

    if (interaction.isRepliable?.()) {
      await interaction.deferReply({ flags });
      return true;
    }

    return false;
  } catch (err) {
    if (!TRANSIENT.has(codeOf(err))) {
      console.warn('safeDefer failed:', err?.message || err);
    }
    return true;
  }
}

/**
 * Safe reply handler for any interaction type (buttons, commands, modals).
 * Automatically skips in workers, and avoids double replies.
 */
async function safeReply(interaction, payload, { preferFollowUp = false } = {}) {
  const data = typeof payload === 'string' ? { content: payload } : (payload || {});

  // Skip if no content at all
  const hasBody =
    !!data.content ||
    (Array.isArray(data.embeds) && data.embeds.length) ||
    (Array.isArray(data.files) && data.files.length) ||
    (Array.isArray(data.components) && data.components.length);

  if (!hasBody) {
    console.warn('safeReply: skipped empty payload');
    return null;
  }

  // 🛑 Skip entirely if we're in a worker (no reply methods)
  if (
    typeof interaction?.reply !== 'function' &&
    typeof interaction?.editReply !== 'function' &&
    typeof interaction?.followUp !== 'function'
  ) {
    return null;
  }

  // Apply ephemeral flags if needed
  if ('ephemeral' in data) {
    const eph = !!data.ephemeral;
    delete data.ephemeral;
    data.flags = eph ? EPH_FLAG : data.flags;
  }

  try {
    // Button or select menu
    if (isComponent(interaction)) {
      if (typeof interaction.update === 'function') {
        try {
          return await interaction.update(data);
        } catch {}
      }

      try {
        return await interaction.editReply(data);
      } catch {}

      console.warn('[safeReply] suppressed followUp for component to avoid dupes.');
      return null;
    }

    // Interaction already deferred
    if (interaction.deferred && !interaction.replied && !preferFollowUp) {
      try {
        return await interaction.editReply(data);
      } catch {
        return await interaction.followUp(data);
      }
    }

    // Interaction fresh
    if (!interaction.deferred && !interaction.replied && !preferFollowUp) {
      return await interaction.reply(data);
    }

    // Fallback: followUp
    return await interaction.followUp(data);
  } catch (err) {
    const code = codeOf(err);
    if (code !== 10062 && code !== 10015) {
      try {
        return await interaction.followUp(data);
      } catch {}
    }

    console.warn(`safeReply final fail (${code ?? 'no-code'}):`, err?.message || err);
    return null;
  }
}

module.exports = { safeReply, safeDefer };
