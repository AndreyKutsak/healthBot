const mongoose = require('mongoose');

const foodHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // null for custom/approximate entries that are not in the food catalog
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
    // food name at the moment of logging (or the custom name)
    name: { type: String, default: null, trim: true, maxlength: 120 },
    // null when the portion weight is unknown (approximate entries)
    amountG: { type: Number, min: 1, default: null },
    calories: { type: Number, required: true, min: 0 },
    // nutrition snapshot at the moment of logging; null = unknown / not snapshotted
    protein: { type: Number, min: 0, default: null },
    fat: { type: Number, min: 0, default: null },
    carbs: { type: Number, min: 0, default: null },
    approx: { type: Boolean, default: false },
    status: { type: String, enum: ['eaten', 'planned'], default: 'eaten' },
    mealType: {
      type: String,
      required: true,
      enum: ['Сніданок', 'Обід', 'Вечеря', 'Перекус'],
    },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FoodHistory', foodHistorySchema);
