const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true },
    username: { type: String, default: null },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    age: { type: Number, required: true, min: 1, max: 120 },
    gender: { type: String, required: true, enum: ['male', 'female'] },
    height: { type: Number, required: true, min: 50, max: 300 },
    weight: { type: Number, required: true, min: 10, max: 500 },
    goal: {
      type: String,
      required: true,
      enum: ['weight_loss', 'muscle_gain', 'maintenance'],
    },
    canUseGym: { type: Boolean, default: null },
    trainingDays: { type: [String], default: [] },
    injuries: { type: String, default: null },
    gymFocus: { type: String, default: null },
    gymExperience: { type: String, default: null },
    dietType: { type: String, default: null },
    mealCount: { type: Number, default: null },
    foodRestrictions: { type: String, default: null },
    dailyCalories: { type: Number, default: null },
    dailyProtein: { type: Number, default: null },
    dailyCarbs: { type: Number, default: null },
    dailyFat: { type: Number, default: null },
    isRegistered: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    lastViolationWarningAt: { type: Date, default: null },
    registrationStep: {
      type: String,
      enum: [
        'age', 'gender', 'height', 'weight', 'goal',
        'gym_question', 'gym_days', 'injuries', 'gym_focus', 'gym_experience',
        'diet_type', 'meal_count', 'food_restrictions', 'done',
      ],
      default: 'age',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
