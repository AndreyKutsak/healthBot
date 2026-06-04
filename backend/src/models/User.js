const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true },
    username: { type: String, default: null },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    age: { type: Number, required: true, min: 1, max: 120 },
    gender: { type: String, required: true, enum: ['male', 'female'] },
    sport: { type: String, required: true, trim: true },
    height: { type: Number, required: true, min: 50, max: 300 },
    weight: { type: Number, required: true, min: 10, max: 500 },
    goal: {
      type: String,
      required: true,
      enum: ['weight_loss', 'muscle_gain', 'maintenance'],
    },
    trainingDays: { type: [String], default: [] },
    trainingTime: { type: String, default: null },
    mealsPerDay: { type: Number, min: 1, max: 10, default: null },
    mealTimes: { type: [String], default: [] },
    isRegistered: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    registrationStep: {
      type: String,
      enum: [
        'age', 'gender', 'sport', 'height', 'weight', 'goal',
        'training_days', 'training_time', 'meals_count', 'meal_times', 'done',
      ],
      default: 'age',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
