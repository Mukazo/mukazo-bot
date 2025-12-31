const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  
  enabledCategories: {
  type: [String],
  default: [],
},
wirlies: { type: Number, default: 1000 },
keys: { type: Number, default: 10 },
dailystreak: {
    count: { type: Number, default: 0},
    lastClaim: { type: Date, default: null }
  },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);