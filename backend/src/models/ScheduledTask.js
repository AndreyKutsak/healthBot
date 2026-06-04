const mongoose = require('mongoose');

const scheduledTaskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    telegramId: { type: Number, required: true, index: true },
    message: { type: String, required: true },
    category: {
      type: String,
      enum: ['nutrition', 'training', 'praise', 'reminder'],
      default: 'reminder',
    },
    type: { type: String, enum: ['one-time', 'recurring'], default: 'one-time' },
    // one-time: exact moment to send
    scheduledAt: { type: Date, index: true },
    // recurring: days of week + time
    recurDays: { type: [String], default: [] },
    recurTime: { type: String, default: null },
    sent: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScheduledTask', scheduledTaskSchema);
