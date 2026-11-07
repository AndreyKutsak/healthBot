const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    telegramId: { type: Number, required: true },
    type: { type: String, enum: ['missed_workout', 'diet_violation'], required: true },
    date: { type: Date, default: Date.now },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Violation', violationSchema);
