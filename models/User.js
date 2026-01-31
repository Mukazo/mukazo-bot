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
weeklystreak: {
    count: { type: Number, default: 0},
    lastClaim: { type: Date, default: null }
  },
  pityData: {
  type: Map,
  of: {
    count: { type: Number, default: 0 },
    codes: [{ type: String }],
    lastUsed: { type: Date }
  },
  default: {}
},
convertLog: {
  count: { type: Number, default: 0 },
  resetAt: { type: Date }
},
castData: {
  used: { type: Number, default: 0 },
  month: { type: Number, default: new Date().getMonth() }
},
  questRerollTokens: { type: Number, default: 0 }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);