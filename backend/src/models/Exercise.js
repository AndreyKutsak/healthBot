const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Кардіо', 'Силові', 'Розтяжка', 'Йога', 'Функціональні', 'Інше'],
    },
    muscleGroup: {
      type: String,
      required: true,
      enum: ['Груди', 'Спина', 'Ноги', 'Плечі', 'Руки', 'Прес', 'Все тіло', 'Інше'],
    },
    description: { type: String, default: '' },
    effectiveness: {
      type: String,
      enum: ['Низька', 'Середня', 'Висока'],
      default: 'Середня',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exercise', exerciseSchema);
