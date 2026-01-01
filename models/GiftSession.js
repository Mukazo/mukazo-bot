const mongoose = require('mongoose');

const GiftSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },    // sender
  targetId: { type: String, required: true },  // recipient

  cards: [
    {
      cardCode: { type: String, required: true },
      qty: { type: Number, required: true },
    },
  ],

  wirlies: { type: Number, default: 0 },

  page: { type: Number, default: 0 },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // ⏱️ auto-delete after 5 minutes
  },
});

module.exports = mongoose.model('GiftSession', GiftSessionSchema);