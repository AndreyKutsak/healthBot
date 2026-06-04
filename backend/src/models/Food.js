const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["М'ясо", 'Риба', 'Молочне', 'Зернові', 'Овочі', 'Фрукти', 'Горіхи', 'Напої', 'Інше'],
    },
    caloriesPer100g: { type: Number, required: true, min: 0 },
    proteinPer100g: { type: Number, default: 0, min: 0 },
    carbsPer100g: { type: Number, default: 0, min: 0 },
    fatPer100g: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Food', foodSchema);
