const cron = require('node-cron');
const User = require('../models/User');
const Exercise = require('../models/Exercise');
const ScheduledTask = require('../models/ScheduledTask');

const CATEGORY_EMOJI = {
  nutrition: '🍽',
  training: '💪',
  praise: '🎉',
  reminder: '🔔',
};

const GOAL_LABEL = {
  weight_loss: 'схуднення',
  muscle_gain: 'набір маси',
  maintenance: 'підтримка форми',
};

// Nutrition tips per goal [breakfast, lunch/mid, dinner, snack]
const MEAL_TIPS = {
  weight_loss: [
    'Рекомендуємо: вівсянка на воді, яйця або нежирний творог. Уникайте швидких вуглеводів.',
    'Ідеально: куряча грудка або риба з овочами та бурим рисом (150–200г).',
    'Легкий варіант: риба на парі, салат або овочевий суп. Не їжте після 19:00.',
    'Перекус: яблуко, кефір 0% або жменя горіхів.',
  ],
  muscle_gain: [
    'Рекомендуємо: вівсянка з бананом + яйця або протеїновий коктейль.',
    'Ідеально: 200г курки/яловичини + гречка або рис + овочі. Не забудьте про вуглеводи!',
    'Вечеря: рибне філе або сир з овочами. Казеїновий протеїн перед сном — плюс.',
    'Перекус: горіхи, протеїновий батончик або грецький йогурт.',
  ],
  maintenance: [
    'Збалансований сніданок: каша + яйця або молочні продукти.',
    'Обід: м\'ясо або риба + гарнір + свіжий салат.',
    'Вечеря: легке білкове блюдо з тушкованими овочами.',
    'Перекус: фрукти, йогурт або жменя горіхів.',
  ],
};

// Track sent notifications to avoid duplicates within the same day
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

function getMealLabel(index, total) {
  if (total === 1) return '🍽 Час для прийому їжі';
  if (index === 0) return '☀️ Час сніданку';
  if (index === total - 1) return '🌙 Час вечері';
  return `🍽 Прийом їжі #${index + 1}`;
}

function getMealTip(goal, mealIndex) {
  const tips = MEAL_TIPS[goal] || MEAL_TIPS.maintenance;
  return tips[mealIndex % tips.length];
}

function startCron(bot) {
  // Every minute: check meal and training reminders
  cron.schedule('* * * * *', async () => {
    const time = currentTimeStr();
    const day = currentDayAbbr();
    const today = todayKey();

    try {
      const users = await User.find({ isRegistered: true, isBlocked: false });

      for (const user of users) {
        const uid = user._id.toString();

        // --- Meal reminder ---
        if (Array.isArray(user.mealTimes) && user.mealTimes.length) {
          const mealIdx = user.mealTimes.indexOf(time);
          if (mealIdx !== -1) {
            const key = `meal_${uid}_${time}_${today}`;
            if (!sentToday.has(key)) {
              sentToday.add(key);
              const label = getMealLabel(mealIdx, user.mealTimes.length);
              const tip = getMealTip(user.goal, mealIdx);
              await bot.telegram.sendMessage(
                user.telegramId,
                `${label} — ${time}\n\n${tip}\n\nНапишіть мені що ви їсте, і я розрахую калорійність та КБЖВ! 📊`,
              );
            }
          }
        }

        // --- Training reminder ---
        if (
          Array.isArray(user.trainingDays) &&
          user.trainingDays.includes(day) &&
          user.trainingTime === time
        ) {
          const key = `train_${uid}_${today}`;
          if (!sentToday.has(key)) {
            sentToday.add(key);

            // Pick 4 random exercises from DB
            const exercises = await Exercise.aggregate([{ $sample: { size: 4 } }]);
            const exerciseList = exercises.length
              ? '\n\n💡 *Рекомендовані вправи на сьогодні:*\n' +
                exercises.map((e) => `• ${e.name} — ${e.category}, ${e.muscleGroup}`).join('\n')
              : '';

            await bot.telegram.sendMessage(
              user.telegramId,
              `💪 *Сьогодні день тренування!*\n\nВид спорту: ${user.sport}\nЧас: ${time}${exerciseList}\n\nПісля тренування розкажіть мені про вправи — все запишу і підіб'ю підсумок! 🏋️`,
              { parse_mode: 'Markdown' },
            );
          }
        }
      }

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
          await bot.telegram.sendMessage(
            task.telegramId,
            `${emoji} ${task.message}`,
          );
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
            await bot.telegram.sendMessage(
              task.telegramId,
              `${emoji} ${task.message}`,
            );
          } catch (sendErr) {
            console.error(`[cron] failed to send recurring task ${task._id}:`, sendErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[cron] error:', err.message);
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
