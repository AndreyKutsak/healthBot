const mongoose = require('mongoose');

const foodHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
    amountG: { type: Number, required: true, min: 1 },
    calories: { type: Number, required: true },
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
