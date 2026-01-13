const mongoose = require('mongoose');

const GiftSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  targetId: { type: String, required: true },

  cards: [
    {
      cardCode: { type: String, required: true },
      qty: { type: Number, required: true },
    },
  ],

  wirlies: { type: Number, default: 0 },
  keys: { type: Number, default: 0 },
  page: { type: Number, default: 0 },

  auth: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300,
  },
});

module.exports = mongoose.model('GiftSession', GiftSessionSchema);