const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  
  enabledCategories: {
  type: [String],
  default: [],
},
wirlies: { type: Number, default: 1000 },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);