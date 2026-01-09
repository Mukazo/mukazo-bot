const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  cardCode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },                   // Display name
  namealias: { type: String},
  categoryalias: { type: String},
  category: { type: String, required: true},
  group: { type: String },                                  // Card group or series
  version: { type: Number, min: 0, max: 5, required:true },
  active: { type: Boolean, default: true},
  emoji: { type: String},
  era: { type: String },                                    // Era or expansion tag
  batch: {
  type: String,
  default: null
},
releaseAt: {
  type: Date,
  default: null
},
deactivateAt: { type: Date, default: null },
availableQuantity: { type: Number, default: null }, // max times pullable
timesPulled: { type: Number, default: 0 },          // counter
  localImagePath: { type: String},
  designerIds: { type: [String], default: [] },                             // Discord user ID of the designer(s)
}, {
  timestamps: true
});

module.exports = mongoose.model('Card', cardSchema);