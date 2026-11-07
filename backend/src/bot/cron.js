const cron = require('node-cron');
const ScheduledTask = require('../models/ScheduledTask');
const TrainingPlan = require('../models/TrainingPlan');
const ExerciseHistory = require('../models/ExerciseHistory');
const User = require('../models/User');
const { checkDailyViolations } = require('./violationChecker');

const CATEGORY_EMOJI = {
  nutrition: '🍽',
  training: '💪',
  praise: '🎉',
  reminder: '🔔',
};

const sentToday = new Set();

function pad(n) {
  return String(n).padStart(2, '0');
}

function currentTimeStr() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function currentDayAbbr() {
  return ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][new Date().getDay()];
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startCron(bot) {
  cron.schedule('* * * * *', async () => {
    const time = currentTimeStr();
    const day = currentDayAbbr();
    const today = todayKey();

    try {
      // --- Dynamic one-time tasks (due now or overdue) ---
      const dueTasks = await ScheduledTask.find({
        type: 'one-time',
        sent: false,
        active: true,
        scheduledAt: { $lte: new Date() },
      });

      for (const task of dueTasks) {
        await ScheduledTask.updateOne({ _id: task._id }, { sent: true });
        const emoji = CATEGORY_EMOJI[task.category] || '🔔';
        try {
          await bot.telegram.sendMessage(task.telegramId, `${emoji} ${task.message}`);
        } catch (sendErr) {
          console.error(`[cron] failed to send task ${task._id}:`, sendErr.message);
        }
      }

      // --- Dynamic recurring tasks ---
      const recurringTasks = await ScheduledTask.find({
        type: 'recurring',
        active: true,
        recurTime: time,
        recurDays: day,
      });

      for (const task of recurringTasks) {
        const key = `dynamic_${task._id}_${today}`;
        if (!sentToday.has(key)) {
          sentToday.add(key);
          const emoji = CATEGORY_EMOJI[task.category] || '🔔';
          try {
            await bot.telegram.sendMessage(task.telegramId, `${emoji} ${task.message}`);
          } catch (sendErr) {
            console.error(`[cron] failed to send recurring task ${task._id}:`, sendErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[cron] error:', err.message);
    }
  });

  // Every day at 20:00: send training plan reminders if workout not yet done
  cron.schedule('0 20 * * *', async () => {
    const day = currentDayAbbr();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const plans = await TrainingPlan.find({ active: true, 'schedule.dayOfWeek': day });
      for (const plan of plans) {
        const user = await User.findById(plan.userId);
        if (!user || user.isBlocked) continue;

        const session = plan.schedule.find((d) => d.dayOfWeek === day);
        if (!session) continue;

        const done = await ExerciseHistory.countDocuments({
          userId: user._id,
          date: { $gte: todayStart, $lt: tomorrow },
        });
        if (done > 0) continue;

        const exList = session.exercises
          .slice(0, 5)
          .map((e) => `• ${e.exerciseName}${e.sets ? ` — ${e.sets}×${e.reps || '?'}` : ''}${e.durationMin ? ` ${e.durationMin}хв` : ''}`)
          .join('\n');

        const msg =
          `💪 Нагадування!\n\nСьогодні за програмою "${plan.name}":\n` +
          `*${session.name}*\n\n${exList}\n\n` +
          `Зафіксуй виконання в боті — я порахую калорії! 🏋️`;
        try {
          await bot.telegram.sendMessage(user.telegramId, msg, { parse_mode: 'Markdown' });
        } catch (e) {
          console.error(`[cron] plan reminder failed for ${user.telegramId}:`, e.message);
        }
      }
    } catch (err) {
      console.error('[cron] training plan reminder error:', err.message);
    }
  });

  // Every day at 22:00: check for missed workouts and diet violations
  cron.schedule('0 22 * * *', async () => {
    try {
      await checkDailyViolations(bot);
    } catch (err) {
      console.error('[cron] violation check error:', err.message);
    }
  });

  // Every hour: clean up yesterday's notification keys
  cron.schedule('0 * * * *', () => {
    const today = todayKey();
    for (const key of sentToday) {
      if (!key.endsWith(today)) sentToday.delete(key);
    }
  });

  console.log('Cron scheduler started');
}

module.exports = { startCron };
