const User = require('../../models/User');
const userState = require('../state');

const SPORTS = [
  'Футбол', 'Баскетбол', 'Волейбол', 'Плавання', 'Біг', 'Велоспорт',
  'Боксінг', 'Борьба', 'Теніс', 'Гімнастика', 'Фітнес', 'Інше',
];

const GOAL_MAP = {
  'Схуднення': 'weight_loss',
  'Набір маси': 'muscle_gain',
  'Підтримка форми': 'maintenance',
};

const GOAL_LABEL = {
  weight_loss: 'Схуднення',
  muscle_gain: 'Набір маси',
  maintenance: 'Підтримка форми',
};

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

function buildDaysKeyboard(selected) {
  const rows = [];
  for (let i = 0; i < DAYS.length; i += 3) {
    rows.push(
      DAYS.slice(i, i + 3).map((day) => ({
        text: (selected.includes(day) ? '✅ ' : '⬜ ') + day,
        callback_data: `td_${day}`,
      }))
    );
  }
  rows.push([{ text: '✅ Підтвердити вибір', callback_data: 'td_done' }]);
  return { inline_keyboard: rows };
}

function isValidTime(t) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim());
}

async function handleRegistration(ctx, user) {
  const text = ctx.message.text.trim();
  const step = user.registrationStep;

  if (step === 'age') {
    const age = parseInt(text, 10);
    if (isNaN(age) || age < 1 || age > 120) {
      return ctx.reply('Невірний вік. Введіть число від 1 до 120:');
    }
    await User.updateOne({ _id: user._id }, { age, registrationStep: 'gender' });
    return ctx.reply('Вкажіть вашу стать:', {
      reply_markup: {
        keyboard: [[{ text: 'Чоловік' }, { text: 'Жінка' }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'gender') {
    const genderMap = { 'Чоловік': 'male', 'Жінка': 'female' };
    const gender = genderMap[text];
    if (!gender) {
      return ctx.reply('Оберіть стать за допомогою кнопок нижче:', {
        reply_markup: {
          keyboard: [[{ text: 'Чоловік' }, { text: 'Жінка' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    await User.updateOne({ _id: user._id }, { gender, registrationStep: 'sport' });
    const keyboard = [];
    for (let i = 0; i < SPORTS.length; i += 3) {
      keyboard.push(SPORTS.slice(i, i + 3).map((s) => ({ text: s })));
    }
    return ctx.reply('Оберіть вид спорту:', {
      reply_markup: { keyboard, resize_keyboard: true, one_time_keyboard: true },
    });
  }

  if (step === 'sport') {
    if (!text || text.length < 2 || text.length > 50) {
      return ctx.reply('Введіть або оберіть вид спорту:');
    }
    await User.updateOne({ _id: user._id }, { sport: text, registrationStep: 'height' });
    return ctx.reply('Введіть ваш зріст у сантиметрах (наприклад: 175):', {
      reply_markup: { remove_keyboard: true },
    });
  }

  if (step === 'height') {
    const height = parseFloat(text);
    if (isNaN(height) || height < 50 || height > 300) {
      return ctx.reply('Невірний зріст. Введіть число від 50 до 300 (см):');
    }
    await User.updateOne({ _id: user._id }, { height, registrationStep: 'weight' });
    return ctx.reply('Введіть вашу вагу у кілограмах (наприклад: 70):');
  }

  if (step === 'weight') {
    const weight = parseFloat(text);
    if (isNaN(weight) || weight < 10 || weight > 500) {
      return ctx.reply('Невірна вага. Введіть число від 10 до 500 (кг):');
    }
    await User.updateOne({ _id: user._id }, { weight, registrationStep: 'goal' });
    return ctx.reply('Оберіть вашу ціль:', {
      reply_markup: {
        keyboard: [
          [{ text: 'Схуднення' }],
          [{ text: 'Набір маси' }],
          [{ text: 'Підтримка форми' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'goal') {
    const goal = GOAL_MAP[text];
    if (!goal) {
      return ctx.reply('Оберіть ціль за допомогою кнопок нижче:', {
        reply_markup: {
          keyboard: [
            [{ text: 'Схуднення' }],
            [{ text: 'Набір маси' }],
            [{ text: 'Підтримка форми' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    await User.updateOne({ _id: user._id }, { goal, registrationStep: 'training_days' });
    userState.set(user.telegramId, 'training_days_select', { selectedDays: [] });
    return ctx.reply(
      'Оберіть дні тренувань (натискайте на дні, потім натисніть «Підтвердити вибір»):',
      {
        reply_markup: buildDaysKeyboard([]),
      }
    );
  }

  if (step === 'training_days') {
    const current = userState.get(user.telegramId);
    const selected = (current && current.data && current.data.selectedDays) || [];
    return ctx.reply('Оберіть дні тренувань за допомогою кнопок нижче:', {
      reply_markup: buildDaysKeyboard(selected),
    });
  }

  if (step === 'training_time') {
    if (!isValidTime(text)) {
      return ctx.reply('Невірний формат часу. Введіть час у форматі ГГ:ХХ (наприклад: 18:00):');
    }
    await User.updateOne(
      { _id: user._id },
      { trainingTime: text.trim(), registrationStep: 'meals_count' }
    );
    return ctx.reply('Скільки разів на день ви харчуєтесь?', {
      reply_markup: {
        keyboard: [
          [{ text: '1' }, { text: '2' }, { text: '3' }],
          [{ text: '4' }, { text: '5' }, { text: '6' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'meals_count') {
    const count = parseInt(text, 10);
    if (isNaN(count) || count < 1 || count > 6) {
      return ctx.reply('Оберіть кількість прийомів їжі за допомогою кнопок (1–6):', {
        reply_markup: {
          keyboard: [
            [{ text: '1' }, { text: '2' }, { text: '3' }],
            [{ text: '4' }, { text: '5' }, { text: '6' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    await User.updateOne({ _id: user._id }, { mealsPerDay: count, registrationStep: 'meal_times' });
    return ctx.reply(
      `Введіть час кожного з ${count} прийомів їжі через кому.\nНаприклад: 08:00, 13:00, 19:00`,
      { reply_markup: { remove_keyboard: true } }
    );
  }

  if (step === 'meal_times') {
    const fresh = await User.findById(user._id);
    const count = fresh.mealsPerDay;
    const parts = text.split(',').map((t) => t.trim());

    if (parts.length !== count) {
      return ctx.reply(
        `Потрібно вказати рівно ${count} часів через кому.\nНаприклад: 08:00, 13:00, 19:00`
      );
    }
    if (!parts.every(isValidTime)) {
      return ctx.reply(
        'Деякі часи мають невірний формат. Використовуйте ГГ:ХХ (наприклад: 08:00, 13:00, 19:00):'
      );
    }

    await User.updateOne(
      { _id: user._id },
      { mealTimes: parts, registrationStep: 'done', isRegistered: true }
    );

    const final = await User.findById(user._id);
    const genderLabel = final.gender === 'male' ? 'Чоловік' : 'Жінка';

    return ctx.reply(
      `✅ Реєстрацію завершено!\n\n` +
      `👤 Ваші дані:\n` +
      `• Вік: ${final.age} р.\n` +
      `• Стать: ${genderLabel}\n` +
      `• Вид спорту: ${final.sport}\n` +
      `• Зріст: ${final.height} см\n` +
      `• Вага: ${final.weight} кг\n` +
      `• Ціль: ${GOAL_LABEL[final.goal]}\n` +
      `• Дні тренувань: ${final.trainingDays.join(', ')}\n` +
      `• Час тренувань: ${final.trainingTime}\n` +
      `• Прийомів їжі на день: ${final.mealsPerDay}\n` +
      `• Час прийомів їжі: ${final.mealTimes.join(', ')}\n\n` +
      `Використовуйте /help для списку доступних команд.`,
      { reply_markup: { remove_keyboard: true } }
    );
  }
}

module.exports = { handleRegistration, DAYS, buildDaysKeyboard };
