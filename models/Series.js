// src/models/Series.js
const mongoose = require('mongoose');

const SeriesSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  category: {
  type: String,
  required: true,
  index: true,
},

  name: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    default: null,
  },

  // This is a PATH on your Hetzner server
  localImagePath: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Series', SeriesSchema);
