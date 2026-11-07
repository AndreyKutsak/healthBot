const User = require('../models/User');
const Violation = require('../models/Violation');
const ExerciseHistory = require('../models/ExerciseHistory');
const FoodHistory = require('../models/FoodHistory');
const TrainingPlan = require('../models/TrainingPlan');

const GOAL_LABEL = {
  weight_loss: 'схуднення',
  muscle_gain: 'набір маси',
  maintenance: 'підтримка форми',
};

const DAY_MAP = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function todayDayAbbr() {
  return DAY_MAP[new Date().getDay()];
}

// Escalating warning messages based on violation count over 7 days
const THRESHOLDS = [
  {
    min: 7,
    build: (n, goal) =>
      `🚨 Серйозне попередження!\n\nЗа останні 7 днів ти порушив(ла) план вже ${n} разів — це критично. Такий темп повністю зводить прогрес нанівець.\n\nТвоя ціль: ${goal}. Час кардинально змінити підхід!`,
  },
  {
    min: 5,
    build: (n, goal) =>
      `⛔ ${n} порушень за тиждень!\n\nПропущені тренування і перевищення калорій не дозволять досягти результату. Пора взяти себе в руки.\n\nЦіль: ${goal} — ти ще можеш наздогнати!`,
  },
  {
    min: 3,
    build: (n, goal) =>
      `⚠️ Увага! За останні 7 днів у тебе вже ${n} порушення плану.\n\nНе дозволяй маленьким зривам стати звичкою. Ціль: ${goal}. Завтра — новий старт!`,
  },
];

async function checkAndWarn(bot, userId) {
  const user = await User.findById(userId);
  if (!user || user.isBlocked) return;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = await Violation.countDocuments({ userId: user._id, date: { $gte: sevenDaysAgo } });

  const threshold = THRESHOLDS.find((t) => count >= t.min);
  if (!threshold) return;

  // Don't repeat warning within 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (user.lastViolationWarningAt && user.lastViolationWarningAt > oneDayAgo) return;

  const goal = GOAL_LABEL[user.goal] || user.goal;
  try {
    await bot.telegram.sendMessage(user.telegramId, threshold.build(count, goal));
    await User.updateOne({ _id: user._id }, { lastViolationWarningAt: new Date() });
  } catch (err) {
    console.error(`[violations] failed to send warning to ${user.telegramId}:`, err.message);
  }
}

async function logViolationAndWarn(bot, user, type, description) {
  // Prevent duplicate violation of the same type on the same day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const already = await Violation.findOne({ userId: user._id, type, date: { $gte: today } });
  if (already) return;

  await Violation.create({ userId: user._id, telegramId: user.telegramId, type, description });
  await checkAndWarn(bot, user._id);
}

async function checkDailyViolations(bot) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAbbr = todayDayAbbr();

  const users = await User.find({ isRegistered: true, isBlocked: false });

  for (const user of users) {
    // Check if today is a training day: first by training plan, then by legacy trainingDays
    const plan = await TrainingPlan.findOne({ userId: user._id, active: true });
    const planHasToday = plan?.schedule.some((d) => d.dayOfWeek === dayAbbr);
    const legacyHasToday = !plan && user.canUseGym && user.trainingDays?.includes(dayAbbr);

    if (planHasToday || legacyHasToday) {
      const exerciseCount = await ExerciseHistory.countDocuments({
        userId: user._id,
        date: { $gte: today, $lt: tomorrow },
      });
      if (exerciseCount === 0) {
        const already = await Violation.findOne({ userId: user._id, type: 'missed_workout', date: { $gte: today } });
        if (!already) {
          const desc = planHasToday
            ? `Пропущено тренування за програмою "${plan.name}" (${dayAbbr})`
            : `Пропущено тренування (${dayAbbr})`;
          await Violation.create({
            userId: user._id,
            telegramId: user.telegramId,
            type: 'missed_workout',
            description: desc,
          });
          await checkAndWarn(bot, user._id);
        }
      }
    }

    // Diet violation: food was logged today and exceeded 120% of daily limit
    if (user.dailyCalories) {
      const foodLogs = await FoodHistory.find({ userId: user._id, date: { $gte: today, $lt: tomorrow }, status: { $ne: 'planned' } });
      const totalCalories = foodLogs.reduce((s, l) => s + (l.calories || 0), 0);
      if (totalCalories > 0 && totalCalories > user.dailyCalories * 1.2) {
        const already = await Violation.findOne({ userId: user._id, type: 'diet_violation', date: { $gte: today } });
        if (!already) {
          await Violation.create({
            userId: user._id,
            telegramId: user.telegramId,
            type: 'diet_violation',
            description: `Перевищення калорій: ${totalCalories} з ${user.dailyCalories} ккал`,
          });
          await checkAndWarn(bot, user._id);
        }
      }
    }
  }
}

module.exports = { checkDailyViolations, logViolationAndWarn, checkAndWarn };
