const Anthropic = require('@anthropic-ai/sdk');
const Food = require('../../models/Food');
const FoodHistory = require('../../models/FoodHistory');
const Exercise = require('../../models/Exercise');
const ExerciseHistory = require('../../models/ExerciseHistory');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Per-user conversation history (in-memory, max 20 messages)
const conversations = new Map();

const GOAL_LABEL = {
  weight_loss: 'схуднення',
  muscle_gain: 'набір маси',
  maintenance: 'підтримка форми',
};

const TOOLS = [
  {
    name: 'search_food',
    description: 'Шукає продукти харчування в базі даних за назвою. Повертає список з КБЖВ.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Назва продукту' },
      },
      required: ['query'],
    },
  },
  {
    name: 'log_food_intake',
    description: 'Записує прийом їжі користувача в базу даних і розраховує КБЖВ.',
    input_schema: {
      type: 'object',
      properties: {
        food_name: { type: 'string', description: 'Точна назва продукту з бази даних' },
        amount_grams: { type: 'number', description: 'Кількість у грамах' },
        meal_type: {
          type: 'string',
          enum: ['Сніданок', 'Обід', 'Вечеря', 'Перекус'],
          description: 'Тип прийому їжі',
        },
      },
      required: ['food_name', 'amount_grams', 'meal_type'],
    },
  },
  {
    name: 'search_exercise',
    description: 'Шукає вправи в базі даних за назвою, категорією або групою м\'язів.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Назва вправи, категорія або група м\'язів' },
      },
      required: ['query'],
    },
  },
  {
    name: 'log_exercise',
    description: 'Записує виконану вправу в базу даних.',
    input_schema: {
      type: 'object',
      properties: {
        exercise_name: { type: 'string', description: 'Назва вправи' },
        sets: { type: 'number', description: 'Кількість підходів (для силових)' },
        reps: { type: 'number', description: 'Кількість повторень (для силових)' },
        weight_kg: { type: 'number', description: 'Вага в кг (для силових)' },
        duration_min: { type: 'number', description: 'Тривалість у хвилинах (для кардіо)' },
        notes: { type: 'string', description: 'Додаткові нотатки' },
      },
      required: ['exercise_name'],
    },
  },
  {
    name: 'get_daily_stats',
    description: 'Повертає статистику харчування та тренувань за сьогодні.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

async function processTool(name, input, user) {
  if (name === 'search_food') {
    const foods = await Food.find({ name: { $regex: input.query, $options: 'i' } }).limit(5);
    if (!foods.length) return { error: 'Продукти не знайдено', query: input.query };
    return {
      foods: foods.map((f) => ({
        name: f.name,
        caloriesPer100g: f.caloriesPer100g,
        proteinPer100g: f.proteinPer100g,
        carbsPer100g: f.carbsPer100g,
        fatPer100g: f.fatPer100g,
        category: f.category,
      })),
    };
  }

  if (name === 'log_food_intake') {
    const food = await Food.findOne({ name: { $regex: input.food_name, $options: 'i' } });
    if (!food) return { error: `Продукт "${input.food_name}" не знайдено в базі даних` };
    const k = input.amount_grams / 100;
    const calories = Math.round(food.caloriesPer100g * k);
    await FoodHistory.create({
      userId: user._id,
      foodId: food._id,
      amountG: input.amount_grams,
      calories,
      mealType: input.meal_type,
    });
    return {
      success: true,
      food: food.name,
      amount: input.amount_grams,
      calories,
      protein: Math.round(food.proteinPer100g * k),
      carbs: Math.round(food.carbsPer100g * k),
      fat: Math.round(food.fatPer100g * k),
      mealType: input.meal_type,
    };
  }

  if (name === 'search_exercise') {
    const exercises = await Exercise.find({
      $or: [
        { name: { $regex: input.query, $options: 'i' } },
        { category: { $regex: input.query, $options: 'i' } },
        { muscleGroup: { $regex: input.query, $options: 'i' } },
      ],
    }).limit(5);
    if (!exercises.length) return { error: 'Вправи не знайдено', query: input.query };
    return {
      exercises: exercises.map((e) => ({
        name: e.name,
        category: e.category,
        muscleGroup: e.muscleGroup,
        effectiveness: e.effectiveness,
      })),
    };
  }

  if (name === 'log_exercise') {
    const exercise = await Exercise.findOne({ name: { $regex: input.exercise_name, $options: 'i' } });
    if (!exercise) return { error: `Вправа "${input.exercise_name}" не знайдено в базі даних` };
    await ExerciseHistory.create({
      userId: user._id,
      exerciseId: exercise._id,
      sets: input.sets,
      reps: input.reps,
      weightKg: input.weight_kg,
      durationMin: input.duration_min,
      notes: input.notes,
    });
    return {
      success: true,
      exercise: exercise.name,
      category: exercise.category,
      sets: input.sets,
      reps: input.reps,
      weightKg: input.weight_kg,
      durationMin: input.duration_min,
    };
  }

  if (name === 'get_daily_stats') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [foodLogs, exerciseLogs] = await Promise.all([
      FoodHistory.find({ userId: user._id, date: { $gte: today, $lt: tomorrow } }).populate('foodId'),
      ExerciseHistory.find({ userId: user._id, date: { $gte: today, $lt: tomorrow } }).populate('exerciseId'),
    ]);

    const totalCalories = foodLogs.reduce((s, l) => s + (l.calories || 0), 0);
    const totalProtein = foodLogs.reduce((s, l) => {
      if (!l.foodId) return s;
      return s + Math.round((l.foodId.proteinPer100g * l.amountG) / 100);
    }, 0);
    const totalCarbs = foodLogs.reduce((s, l) => {
      if (!l.foodId) return s;
      return s + Math.round((l.foodId.carbsPer100g * l.amountG) / 100);
    }, 0);
    const totalFat = foodLogs.reduce((s, l) => {
      if (!l.foodId) return s;
      return s + Math.round((l.foodId.fatPer100g * l.amountG) / 100);
    }, 0);

    return {
      date: today.toLocaleDateString('uk-UA'),
      nutrition: { totalCalories, totalProtein, totalCarbs, totalFat },
      foodEntries: foodLogs.map((l) => ({
        food: l.foodId ? l.foodId.name : 'Невідомо',
        amount: l.amountG,
        calories: l.calories,
        mealType: l.mealType,
      })),
      exercises: exerciseLogs.map((l) => ({
        name: l.exerciseId ? l.exerciseId.name : 'Невідомо',
        sets: l.sets,
        reps: l.reps,
        weight: l.weightKg,
        duration: l.durationMin,
      })),
    };
  }

  return { error: 'Unknown tool' };
}

async function handleAI(ctx, user) {
  const userText = ctx.message.text;
  const telegramId = user.telegramId;

  if (!conversations.has(telegramId)) conversations.set(telegramId, []);
  const history = conversations.get(telegramId);

  history.push({ role: 'user', content: userText });
  if (history.length > 20) history.splice(0, history.length - 20);

  const systemPrompt = [
    {
      type: 'text',
      text:
        `Ти персональний асистент зі здоров'я та фітнесу у Telegram-боті. Відповідай виключно українською.\n\n` +
        `Профіль користувача:\n` +
        `- Ціль: ${GOAL_LABEL[user.goal] || user.goal}\n` +
        `- Вид спорту: ${user.sport}\n` +
        `- Дні тренувань: ${user.trainingDays?.join(', ') || '—'}\n` +
        `- Час тренувань: ${user.trainingTime || '—'}\n` +
        `- Прийомів їжі: ${user.mealsPerDay || '—'} на день (${user.mealTimes?.join(', ') || '—'})\n\n` +
        `Правила:\n` +
        `1. Якщо користувач розповідає що з'їв — спочатку виклич search_food, потім log_food_intake, потім надай аналіз КБЖВ та пораду щодо цілі.\n` +
        `2. Якщо розповідає про тренування — виклич search_exercise, потім log_exercise, підбий підсумок.\n` +
        `3. На запит статистики — виклич get_daily_stats.\n` +
        `4. Давай короткі практичні поради щодо харчування та тренувань відповідно до цілі.\n` +
        `5. Якщо продукт чи вправа не знайдені в базі — поясни і запропонуй альтернативу.`,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const messages = [...history];

  try {
    let response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    // Agentic loop
    while (response.stop_reason === 'tool_use') {
      const assistantMsg = { role: 'assistant', content: response.content };
      messages.push(assistantMsg);

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await processTool(block.name, block.input, user);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });

      response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });
    }

    const replyText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (replyText) {
      history.push({ role: 'assistant', content: replyText });
      await ctx.reply(replyText);
    }
  } catch (err) {
    console.error('Claude API error:', err.message);
    await ctx.reply('Виникла помилка при обробці запиту. Спробуйте ще раз.');
  }
}

function clearHistory(telegramId) {
  conversations.delete(telegramId);
}

module.exports = { handleAI, clearHistory };
