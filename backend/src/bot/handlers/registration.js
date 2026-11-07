const User = require('../../models/User');
const userState = require('../state');
const { MAIN_KEYBOARD } = require('../keyboard');

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

const GYM_FOCUS_OPTIONS = [
  'Верхня частина тіла',
  'Нижня частина тіла',
  'Все тіло',
  'Схуднення + кардіо',
];

const EXP_MAP = {
  'Початківець': 'beginner',
  'Середній рівень': 'intermediate',
  'Просунутий': 'advanced',
};

const EXP_LABEL = {
  beginner: 'Початківець',
  intermediate: 'Середній рівень',
  advanced: 'Просунутий',
};

const DIET_OPTIONS = ['Звичайне', 'Вегетаріанське', 'Веганське', 'Низьковуглеводне', 'Кето'];
const DIET_MAP = {
  'Звичайне': 'standard',
  'Вегетаріанське': 'vegetarian',
  'Веганське': 'vegan',
  'Низьковуглеводне': 'low_carb',
  'Кето': 'keto',
};
const DIET_LABEL = {
  standard: 'Звичайне',
  vegetarian: 'Вегетаріанське',
  vegan: 'Веганське',
  low_carb: 'Низьковуглеводне',
  keto: 'Кето',
};

const MEAL_COUNT_MAP = { '3 рази': 3, '4 рази': 4, '5 разів': 5, '6+ разів': 6 };

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

function calculateKBJU(user) {
  // Mifflin-St Jeor
  let bmr;
  if (user.gender === 'male') {
    bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age + 5;
  } else {
    bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age - 161;
  }

  // Activity multiplier based on gym days per week
  let multiplier = 1.2;
  if (user.canUseGym && user.trainingDays && user.trainingDays.length > 0) {
    const days = user.trainingDays.length;
    if (days <= 2) multiplier = 1.375;
    else if (days <= 5) multiplier = 1.55;
    else multiplier = 1.725;
  }

  const tdee = Math.round(bmr * multiplier);

  let targetCalories;
  if (user.goal === 'weight_loss') {
    targetCalories = Math.max(tdee - 500, 1200);
  } else if (user.goal === 'muscle_gain') {
    targetCalories = tdee + 300;
  } else {
    targetCalories = tdee;
  }

  let proteinG;
  if (user.goal === 'muscle_gain') proteinG = Math.round(user.weight * 2.5);
  else if (user.goal === 'weight_loss') proteinG = Math.round(user.weight * 2.2);
  else proteinG = Math.round(user.weight * 2.0);

  const fatG = Math.round((targetCalories * 0.25) / 9);
  const carbsG = Math.max(Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4), 0);

  return { tdee, targetCalories, protein: proteinG, fat: fatG, carbs: carbsG };
}

function buildCompletionMessage(user, kbju) {
  const genderLabel = user.gender === 'male' ? 'Чоловік' : 'Жінка';

  let goalLine;
  if (user.goal === 'weight_loss') {
    goalLine = `📉 Під ціль (схуднення): ${kbju.targetCalories} ккал/день (дефіцит ~${kbju.tdee - kbju.targetCalories} ккал)`;
  } else if (user.goal === 'muscle_gain') {
    goalLine = `📈 Під ціль (набір маси): ${kbju.targetCalories} ккал/день (профіцит ~${kbju.targetCalories - kbju.tdee} ккал)`;
  } else {
    goalLine = `⚖️ Норма (підтримка форми): ${kbju.targetCalories} ккал/день`;
  }

  let gymSection = '';
  if (user.canUseGym) {
    gymSection =
      `• Дні в залі: ${user.trainingDays?.join(', ') || '—'}\n` +
      `• Травми: ${user.injuries || '—'}\n` +
      `• Упор: ${user.gymFocus || '—'}\n` +
      `• Досвід: ${EXP_LABEL[user.gymExperience] || '—'}\n`;
  }

  let dietSection = '';
  if (user.dietType || user.mealCount) {
    dietSection =
      `\n🥗 Профіль харчування:\n` +
      (user.dietType ? `• Тип: ${DIET_LABEL[user.dietType] || user.dietType}\n` : '') +
      (user.mealCount ? `• Прийомів їжі: ${user.mealCount}/день\n` : '') +
      (user.foodRestrictions ? `• Обмеження: ${user.foodRestrictions}\n` : '');
  }

  return (
    `✅ Реєстрацію завершено!\n\n` +
    `👤 Твій профіль:\n` +
    `• Вік: ${user.age} р.\n` +
    `• Стать: ${genderLabel}\n` +
    `• Зріст: ${user.height} см\n` +
    `• Вага: ${user.weight} кг\n` +
    `• Ціль: ${GOAL_LABEL[user.goal]}\n` +
    `• Спортзал: ${user.canUseGym ? 'Так' : 'Ні'}\n` +
    gymSection +
    dietSection +
    `\n📊 Розрахунок КБЖВ:\n` +
    `🔥 Базовий обмін (TDEE): ${kbju.tdee} ккал/день\n` +
    `${goalLine}\n\n` +
    `🥩 Білки: ${kbju.protein} г\n` +
    `🧈 Жири: ${kbju.fat} г\n` +
    `🍞 Вуглеводи: ${kbju.carbs} г\n\n` +
    `Використовуйте /help для списку доступних команд.`
  );
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
    await User.updateOne({ _id: user._id }, { gender, registrationStep: 'height' });
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
    await User.updateOne({ _id: user._id }, { goal, registrationStep: 'gym_question' });
    return ctx.reply('Чи маєш ти змогу займатись у спортзалі?', {
      reply_markup: {
        keyboard: [[{ text: 'Так' }, { text: 'Ні' }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'gym_question') {
    if (text === 'Так') {
      await User.updateOne({ _id: user._id }, { canUseGym: true, registrationStep: 'gym_days' });
      userState.set(user.telegramId, 'training_days_select', { selectedDays: [] });
      return ctx.reply(
        'Чудово! Оберіть дні, коли ти ходиш у спортзал\n(натискай на дні, потім «Підтвердити вибір»):',
        { reply_markup: buildDaysKeyboard([]) }
      );
    }
    if (text === 'Ні') {
      await User.updateOne({ _id: user._id }, { canUseGym: false, registrationStep: 'diet_type' });
      return ctx.reply('Оберіть тип вашого харчування:', {
        reply_markup: {
          keyboard: [
            [{ text: 'Звичайне' }, { text: 'Вегетаріанське' }],
            [{ text: 'Веганське' }, { text: 'Низьковуглеводне' }],
            [{ text: 'Кето' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    return ctx.reply('Будь ласка, оберіть відповідь:', {
      reply_markup: {
        keyboard: [[{ text: 'Так' }, { text: 'Ні' }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'gym_days') {
    const current = userState.get(user.telegramId);
    const selected = (current && current.data && current.data.selectedDays) || [];
    return ctx.reply('Оберіть дні за допомогою кнопок нижче:', {
      reply_markup: buildDaysKeyboard(selected),
    });
  }

  if (step === 'injuries') {
    await User.updateOne({ _id: user._id }, { injuries: text, registrationStep: 'gym_focus' });
    return ctx.reply('На що хочеш зробити упор у тренуваннях?', {
      reply_markup: {
        keyboard: [
          [{ text: GYM_FOCUS_OPTIONS[0] }, { text: GYM_FOCUS_OPTIONS[1] }],
          [{ text: GYM_FOCUS_OPTIONS[2] }, { text: GYM_FOCUS_OPTIONS[3] }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'gym_focus') {
    if (!GYM_FOCUS_OPTIONS.includes(text)) {
      return ctx.reply('Оберіть один із варіантів:', {
        reply_markup: {
          keyboard: [
            [{ text: GYM_FOCUS_OPTIONS[0] }, { text: GYM_FOCUS_OPTIONS[1] }],
            [{ text: GYM_FOCUS_OPTIONS[2] }, { text: GYM_FOCUS_OPTIONS[3] }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    await User.updateOne({ _id: user._id }, { gymFocus: text, registrationStep: 'gym_experience' });
    return ctx.reply('Який у тебе досвід тренувань у залі?', {
      reply_markup: {
        keyboard: [
          [{ text: 'Початківець' }],
          [{ text: 'Середній рівень' }],
          [{ text: 'Просунутий' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'gym_experience') {
    const exp = EXP_MAP[text];
    if (!exp) {
      return ctx.reply('Оберіть рівень досвіду за допомогою кнопок:', {
        reply_markup: {
          keyboard: [
            [{ text: 'Початківець' }],
            [{ text: 'Середній рівень' }],
            [{ text: 'Просунутий' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    await User.updateOne({ _id: user._id }, { gymExperience: exp, registrationStep: 'diet_type' });
    return ctx.reply('Оберіть тип вашого харчування:', {
      reply_markup: {
        keyboard: [
          [{ text: 'Звичайне' }, { text: 'Вегетаріанське' }],
          [{ text: 'Веганське' }, { text: 'Низьковуглеводне' }],
          [{ text: 'Кето' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'diet_type') {
    const diet = DIET_MAP[text];
    if (!diet) {
      return ctx.reply('Оберіть тип харчування за допомогою кнопок:', {
        reply_markup: {
          keyboard: [
            [{ text: 'Звичайне' }, { text: 'Вегетаріанське' }],
            [{ text: 'Веганське' }, { text: 'Низьковуглеводне' }],
            [{ text: 'Кето' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    await User.updateOne({ _id: user._id }, { dietType: diet, registrationStep: 'meal_count' });
    return ctx.reply('Скільки прийомів їжі у тебе на день?', {
      reply_markup: {
        keyboard: [
          [{ text: '3 рази' }, { text: '4 рази' }],
          [{ text: '5 разів' }, { text: '6+ разів' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  if (step === 'meal_count') {
    const mealCount = MEAL_COUNT_MAP[text];
    if (!mealCount) {
      return ctx.reply('Оберіть кількість прийомів їжі:', {
        reply_markup: {
          keyboard: [
            [{ text: '3 рази' }, { text: '4 рази' }],
            [{ text: '5 разів' }, { text: '6+ разів' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    await User.updateOne({ _id: user._id }, { mealCount, registrationStep: 'food_restrictions' });
    return ctx.reply(
      'Чи є у тебе харчові обмеження або алергії?\n(Напиши "Немає" або перелічи свої обмеження)',
      {
        reply_markup: {
          keyboard: [[{ text: 'Немає' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  }

  if (step === 'food_restrictions') {
    const restrictions = text === 'Немає' ? null : text;
    await User.updateOne(
      { _id: user._id },
      { foodRestrictions: restrictions, registrationStep: 'done', isRegistered: true }
    );
    const final = await User.findById(user._id);
    const kbju = calculateKBJU(final);
    await User.updateOne({ _id: user._id }, {
      dailyCalories: kbju.targetCalories,
      dailyProtein: kbju.protein,
      dailyCarbs: kbju.carbs,
      dailyFat: kbju.fat,
    });
    return ctx.reply(buildCompletionMessage(final, kbju), MAIN_KEYBOARD);
  }
}

module.exports = { handleRegistration, DAYS, buildDaysKeyboard, calculateKBJU, EXP_LABEL, DIET_LABEL };
