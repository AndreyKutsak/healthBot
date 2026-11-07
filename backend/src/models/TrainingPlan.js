const mongoose = require('mongoose');

const planExerciseSchema = new mongoose.Schema({
  exerciseName: { type: String, required: true },
  sets: { type: Number, default: null },
  reps: { type: Number, default: null },
  durationMin: { type: Number, default: null },
  restSec: { type: Number, default: 60 },
  notes: { type: String, default: '' },
}, { _id: false });

const trainingDaySchema = new mongoose.Schema({
  dayOfWeek: { type: String, required: true, enum: ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'] },
  name: { type: String, required: true },
  exercises: [planExerciseSchema],
}, { _id: false });

const trainingPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  goal: { type: String, default: null },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  weeksTotal: { type: Number, default: 4 },
  active: { type: Boolean, default: true, index: true },
  schedule: [trainingDaySchema],
}, { timestamps: true });

module.exports = mongoose.model('TrainingPlan', trainingPlanSchema);
