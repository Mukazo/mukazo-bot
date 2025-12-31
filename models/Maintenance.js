const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  endsAt: { type: Date, default: null },
  reason: { type: String, default: null },
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);
