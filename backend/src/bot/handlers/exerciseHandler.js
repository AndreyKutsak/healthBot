const Exercise = require('../../models/Exercise');
const ExerciseHistory = require('../../models/ExerciseHistory');
const stateStore = require('../state');
const { MAIN_KEYBOARD } = require('../keyboard');
const { handleAI } = require('./aiHandler');

const CATEGORIES = ['Кардіо', 'Силові', 'Розтяжка', 'Йога', 'Функціональні', 'Інше'];
const CANCEL = '❌ Скасувати';

const EFFECTIVENESS_EMOJI = { Низька: '🟡', Середня: '🟠', Висока: '🟢' };

function mkKeyboard(rows) {
  return {
    reply_markup: {
      keyboard: [...rows, [{ text: CANCEL }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

async function handleExercise(ctx, user, text) {
  const telegramId = user.telegramId;
  const userId = user._id;

  if (text === '/log_exercise' || text === '🏋️ Тренування') {
    stateStore.set(telegramId, 'exercise_category');
    const rows = [];
    for (let i = 0; i < CATEGORIES.length; i += 3) {
      rows.push(CATEGORIES.slice(i, i + 3).map((c) => ({ text: c })));
    }
    await ctx.reply('🏋️ Оберіть категорію вправи:', mkKeyboard(rows));
    return true;
  }

  const st = stateStore.get(telegramId);
  if (!st || !st.state.startsWith('exercise_')) return false;

  if (text === CANCEL) {
    stateStore.clear(telegramId);
    await ctx.reply('Скасовано.', MAIN_KEYBOARD);
    return true;
  }

  if (st.state === 'exercise_ai_name') {
    stateStore.clear(telegramId);
    await handleAI(ctx, user);
    return true;
  }

  if (st.state === 'exercise_category') {
    if (!CATEGORIES.includes(text)) {
      await ctx.reply('Оберіть категорію з кнопок нижче:');
      return true;
    }
    const exercises = await Exercise.find({ category: text }).sort({ name: 1 }).limit(20);
    if (!exercises.length) {
      stateStore.set(telegramId, 'exercise_ai_name', { category: text });
      await ctx.reply(
        `У категорії "${text}" ще немає вправ у базі.\n\nНапишіть назву вправи — я запишу її автоматично:`,
        { reply_markup: { keyboard: [[{ text: CANCEL }]], resize_keyboard: true, one_time_keyboard: true } }
      );
      return true;
    }
    stateStore.set(telegramId, 'exercise_pick', {
      category: text,
      exercises: exercises.map((e) => ({
        id: e._id.toString(),
        name: e.name,
        effectiveness: e.effectiveness || 'Середня',
      })),
    });
    const rows = [];
    const names = exercises.map((e) => e.name);
    for (let i = 0; i < names.length; i += 2) {
      rows.push(names.slice(i, i + 2).map((n) => ({ text: n })));
    }
    await ctx.reply(`Оберіть вправу (${text}):`, mkKeyboard(rows));
    return true;
  }

  if (st.state === 'exercise_pick') {
    const ex = st.data.exercises.find((e) => e.name === text);
    if (!ex) {
      await ctx.reply('Оберіть вправу з кнопок нижче:');
      return true;
    }
    const eff = ex.effectiveness;
    const effLine = `📊 Ефективність: ${EFFECTIVENESS_EMOJI[eff] || ''} ${eff}`;
    stateStore.set(telegramId, 'exercise_details', { ...st.data, selectedEx: ex });

    const noKb = { reply_markup: { remove_keyboard: true } };
    if (st.data.category === 'Кардіо') {
      await ctx.reply(
        `✅ Вправа: *${ex.name}*\n${effLine}\n\nВведіть тривалість тренування (хвилин), наприклад: *30*`,
        { parse_mode: 'Markdown', ...noKb }
      );
    } else {
      await ctx.reply(
        `✅ Вправа: *${ex.name}*\n${effLine}\n\nВведіть підходи, повторення та вагу (кг) через пробіл:\nНаприклад: *3 10 70*\n(якщо вага не потрібна — введіть 0)`,
        { parse_mode: 'Markdown', ...noKb }
      );
    }
    return true;
  }

  if (st.state === 'exercise_details') {
    const { selectedEx, category } = st.data;
    const log = { userId, exerciseId: selectedEx.id, date: new Date() };
    let summary;

    if (category === 'Кардіо') {
      const dur = parseFloat(text);
      if (isNaN(dur) || dur < 1 || dur > 600) {
        await ctx.reply('Введіть число від 1 до 600 (хвилини):');
        return true;
      }
      log.durationMin = dur;
      summary = `⏱ Тривалість: ${dur} хв`;
    } else {
      const parts = text.trim().split(/\s+/).map(Number);
      if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1]) || parts[0] < 1 || parts[1] < 1) {
        await ctx.reply('Невірний формат. Введіть: підходи повторення вага\nНаприклад: 3 10 70');
        return true;
      }
      log.sets = parts[0];
      log.reps = parts[1];
      if (!isNaN(parts[2]) && parts[2] > 0) log.weightKg = parts[2];
      summary = `📊 ${log.sets} підходів × ${log.reps} повторень${log.weightKg ? ` @ ${log.weightKg} кг` : ''}`;
    }

    await ExerciseHistory.create(log);
    stateStore.clear(telegramId);
    await ctx.reply(`✅ Тренування записано!\n\n🏋️ *${selectedEx.name}*\n${summary}`, {
      parse_mode: 'Markdown',
      ...MAIN_KEYBOARD,
    });
    return true;
  }

  return false;
}

module.exports = { handleExercise };
