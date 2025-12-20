const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  releaseAt: { type: Date, required: true, index: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('Batch', batchSchema);
