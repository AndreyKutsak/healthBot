const { EXP_LABEL } = require('./registration');
const TrainingPlan = require('../../models/TrainingPlan');
const FoodHistory = require('../../models/FoodHistory');
const ExerciseHistory = require('../../models/ExerciseHistory');
const { MAIN_KEYBOARD } = require('../keyboard');
const { EATEN, sumNutrition, entryName } = require('../../utils/nutrition');

const GOAL_LABEL = {
  weight_loss: 'Схуднення',
  muscle_gain: 'Набір маси',
  maintenance: 'Підтримка форми',
};

const TG_MAX = 4000;

async function sendLong(ctx, text) {
  if (text.length <= TG_MAX) { return ctx.reply(text); }
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= TG_MAX) { await ctx.reply(remaining); break; }
    let cut = remaining.lastIndexOf('\n', TG_MAX);
    if (cut <= 0) cut = TG_MAX;
    await ctx.reply(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
}

async function handleDailyStats(ctx, user) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [foodLogs, exerciseLogs] = await Promise.all([
    FoodHistory.find({ userId: user._id, date: { $gte: today, $lt: tomorrow }, ...EATEN }).populate('foodId'),
    ExerciseHistory.find({ userId: user._id, date: { $gte: today, $lt: tomorrow } }).populate('exerciseId'),
  ]);

  const { calories: totalCalories, protein: totalProtein, carbs: totalCarbs, fat: totalFat } = sumNutrition(foodLogs);
  const totalBurned   = exerciseLogs.reduce((s, l) => s + (l.caloriesBurned || 0), 0);

  let msg = `📊 Статистика за ${today.toLocaleDateString('uk-UA')}:\n\n`;

  msg += `🍽 Харчування:\n`;
  if (!foodLogs.length) {
    msg += `  • Записів ще немає\n`;
  } else {
    for (const l of foodLogs) {
      msg += `  • ${entryName(l)} — ${l.amountG ? `${l.amountG}г, ` : ''}${l.approx ? '≈' : ''}${l.calories} ккал (${l.mealType})\n`;
    }
  }
  msg += `\n🔥 Калорій: ${totalCalories}`;
  if (user.dailyCalories) {
    const rem = user.dailyCalories - totalCalories;
    msg += ` / ${user.dailyCalories} ккал — залишок: ${Math.abs(rem)} ${rem >= 0 ? '✅' : '⚠️ перевищення'}`;
  }
  msg += `\n🥩 Б: ${totalProtein}г   🧈 Ж: ${totalFat}г   🍞 В: ${totalCarbs}г\n`;

  msg += `\n🏋️ Тренування:\n`;
  if (!exerciseLogs.length) {
    msg += `  • Тренувань не записано\n`;
  } else {
    for (const l of exerciseLogs) {
      let line = `  • ${l.exerciseId?.name || '—'}`;
      if (l.sets && l.reps) line += ` — ${l.sets}×${l.reps}`;
      if (l.weightKg) line += ` @ ${l.weightKg} кг`;
      if (l.durationMin) line += ` — ${l.durationMin} хв`;
      if (l.caloriesBurned) line += ` (🔥 ${l.caloriesBurned} ккал)`;
      msg += line + '\n';
    }
    msg += `\n💪 Спалено: ${totalBurned} ккал`;
    if (totalCalories > 0) {
      msg += `   Чистий баланс: ${totalCalories - totalBurned} ккал`;
    }
  }

  return ctx.reply(msg);
}

async function handleMyPlan(ctx, user) {
  const plan = await TrainingPlan.findOne({ userId: user._id, active: true });
  if (!plan) {
    return ctx.reply(
      'У вас немає активної програми тренувань.\n\n' +
      'Напишіть мені "склади програму тренувань" і я створю персоналізовану програму для вас!'
    );
  }

  let msg = `📋 ${plan.name}\n`;
  msg += `⏱ Тривалість: ${plan.weeksTotal} тижнів\n`;
  if (plan.createdAt) msg += `📆 Створено: ${plan.createdAt.toLocaleDateString('uk-UA')}\n`;
  msg += '\n';

  for (const day of plan.schedule) {
    msg += `📅 ${day.dayOfWeek} — ${day.name}\n`;
    for (const ex of day.exercises) {
      let line = `• ${ex.exerciseName}`;
      if (ex.sets && ex.reps) line += ` — ${ex.sets}×${ex.reps}`;
      if (ex.durationMin) line += ` — ${ex.durationMin} хв`;
      if (ex.restSec) line += ` (відп. ${ex.restSec}с)`;
      if (ex.notes) line += `\n  💬 ${ex.notes}`;
      msg += line + '\n';
    }
    msg += '\n';
  }

  return sendLong(ctx, msg);
}

// Texts sent by the main keyboard buttons
const BUTTON_ALIASES = {
  '🏋️ Тренування': '/log_exercise',
  '🍎 Їжа':         '/log_food',
  '📊 Статистика':  '__stats__',
  '📋 Моя програма':'__my_plan__',
  '👤 Профіль':     '/profile',
  'ℹ️ Допомога':    '/help',
};

async function handleCommands(ctx, user) {
  const raw = ctx.message.text;
  const text = BUTTON_ALIASES[raw] || raw;

  if (text === '/help') {
    return ctx.reply(
      '📋 Доступні команди:\n\n' +
      '/profile — переглянути профіль\n' +
      '/my_plan — програма тренувань\n' +
      '/log_exercise — записати тренування\n' +
      '/log_food — записати прийом їжі\n' +
      '/help — список команд\n\n' +
      'Або просто напишіть що ви їли чи яке тренування зробили — бот все запише та підрахує.'
    );
  }

  if (text === '__stats__') return handleDailyStats(ctx, user);
  if (text === '__my_plan__' || text === '/my_plan') return handleMyPlan(ctx, user);

  if (text === '/profile') {
    const genderLabel = user.gender === 'male' ? 'Чоловік' : 'Жінка';
    const gymDays = user.trainingDays?.length ? user.trainingDays.join(', ') : '—';

    let gymSection = '';
    if (user.canUseGym) {
      gymSection =
        `• Дні в залі: ${gymDays}\n` +
        `• Травми: ${user.injuries || '—'}\n` +
        `• Упор: ${user.gymFocus || '—'}\n` +
        `• Досвід: ${EXP_LABEL[user.gymExperience] || '—'}\n`;
    }

    const kbjuSection = user.dailyCalories
      ? `\n📊 Денна норма:\n` +
        `• Калорії: ${user.dailyCalories} ккал\n` +
        `• Білки: ${user.dailyProtein} г\n` +
        `• Жири: ${user.dailyFat} г\n` +
        `• Вуглеводи: ${user.dailyCarbs} г`
      : '';

    return ctx.reply(
      `👤 Ваш профіль:\n\n` +
      `• Вік: ${user.age} р.\n` +
      `• Стать: ${genderLabel}\n` +
      `• Зріст: ${user.height} см\n` +
      `• Вага: ${user.weight} кг\n` +
      `• Ціль: ${GOAL_LABEL[user.goal] || '—'}\n` +
      `• Спортзал: ${user.canUseGym ? 'Так' : 'Ні'}\n` +
      gymSection +
      kbjuSection
    );
  }

  return ctx.reply('Невідома команда. Використовуйте /help для списку команд.');
}

module.exports = { handleCommands, BUTTON_ALIASES };
