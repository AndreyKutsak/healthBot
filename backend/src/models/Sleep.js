const mongoose = require('mongoose');

// One manual sleep record per user per day. `date` is the local wake-up day (YYYY-MM-DD).
const sleepSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    durationMin: { type: Number, required: true, min: 0, max: 1440 },
    quality: { type: String, enum: ['bad', 'ok', 'good', null], default: null },
  },
  { timestamps: true }
);

sleepSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Sleep', sleepSchema);
