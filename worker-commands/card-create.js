const { EmbedBuilder, AttachmentBuilder, REST, Routes } = require('discord.js');
const { Card } = require('../models/Card');
const { CardBatch } = require('../models/Batch');
const { generateCardImageBuffer } = require('../lib/imageGen');

module.exports = {
  key: 'card-create',

  async execute(payload) {
    const {
      cardcode, category, version, group, name, designer,
      active, imageUrl, era, emoji,
      batchId, userId, channelId, interactionToken, interactionId
    } = payload;

    try {
      // 1. Save card to DB
      const newCard = await Card.create({
        cardcode, category, version, group, name,
        designer, active, image: imageUrl, era, emoji,
        batch: batchId,
      });

      // 2. Attach card to batch
      await CardBatch.findByIdAndUpdate(batchId, {
        $push: { cards: newCard._id }
      });

      // 3. Generate card image buffer (optional: your logic)
      const imageBuffer = await generateCardImageBuffer(newCard);
      const file = new AttachmentBuilder(imageBuffer, { name: `${cardcode}.png` });

      // 4. Prepare embed
      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${name}`)
        .setDescription(`**Created by:** <@${userId}>\n**Category:** ${category}\n**Group:** ${group}\n**Batch:** ${batchId}`)
        .setImage(`attachment://${cardcode}.png`)
        .setFooter({ text: 'Card created successfully' });

      // 5. Send to Discord via webhook
      const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
      const webhookPath = Routes.webhook(process.env.APP_ID, interactionToken);

      await rest.post(webhookPath, {
        body: {
          content: `<@${userId}> ✅ Card created!`,
          embeds: [embed],
        },
        files: [file],
      });

      console.log('[Worker] ✅ Card created and sent.');
    } catch (err) {
      console.error('[Worker] ❌ Error creating card:', err);
    }
  }
};
