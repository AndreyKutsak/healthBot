const Food = require('../../models/Food');
const FoodHistory = require('../../models/FoodHistory');
const stateStore = require('../state');

const MEAL_TYPES = ['Сніданок', 'Обід', 'Вечеря', 'Перекус'];
const CANCEL = '❌ Скасувати';

function mkKeyboard(rows) {
  return {
    reply_markup: {
      keyboard: [...rows, [{ text: CANCEL }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

const rmKeyboard = { reply_markup: { remove_keyboard: true } };

async function handleFood(ctx, user, text) {
  const telegramId = user.telegramId;
  const userId = user._id;

  if (text === '/log_food') {
    stateStore.set(telegramId, 'food_search');
    await ctx.reply('🥗 Введіть назву продукту для пошуку:', rmKeyboard);
    return true;
  }

  const st = stateStore.get(telegramId);
  if (!st || !st.state.startsWith('food_')) return false;

  if (text === CANCEL) {
    stateStore.clear(telegramId);
    await ctx.reply('Скасовано.', rmKeyboard);
    return true;
  }

  if (st.state === 'food_search') {
    const foods = await Food.find({ name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .sort({ name: 1 })
      .limit(8);
    if (!foods.length) {
      await ctx.reply('Продукт не знайдено. Спробуйте інший запит або зверніться до адміністратора:');
      return true;
    }
    stateStore.set(telegramId, 'food_pick', {
      foods: foods.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        caloriesPer100g: f.caloriesPer100g,
        category: f.category,
      })),
    });
    const rows = [];
    const names = foods.map((f) => f.name);
    for (let i = 0; i < names.length; i += 2) {
      rows.push(names.slice(i, i + 2).map((n) => ({ text: n })));
    }
    await ctx.reply(`Знайдено: ${foods.length}. Оберіть продукт:`, mkKeyboard(rows));
    return true;
  }

  if (st.state === 'food_pick') {
    const food = st.data.foods.find((f) => f.name === text);
    if (!food) {
      await ctx.reply('Оберіть продукт з кнопок нижче:');
      return true;
    }
    stateStore.set(telegramId, 'food_amount', { food });
    await ctx.reply(
      `✅ Продукт: *${food.name}*\n🔥 Калорійність: *${food.caloriesPer100g} ккал* / 100 г\n\nВведіть кількість у грамах (наприклад: *200*):`,
      { parse_mode: 'Markdown', ...rmKeyboard }
    );
    return true;
  }

  if (st.state === 'food_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount < 1 || amount > 5000) {
      await ctx.reply('Введіть кількість від 1 до 5000 грамів:');
      return true;
    }
    const calories = Math.round((st.data.food.caloriesPer100g * amount) / 100);
    stateStore.set(telegramId, 'food_mealtype', { ...st.data, amountG: amount, calories });
    const rows = MEAL_TYPES.map((m) => [{ text: m }]);
    await ctx.reply(
      `🔥 Калорій: *${calories} ккал* (${amount} г)\n\nОберіть прийом їжі:`,
      { parse_mode: 'Markdown', ...mkKeyboard(rows) }
    );
    return true;
  }

  if (st.state === 'food_mealtype') {
    if (!MEAL_TYPES.includes(text)) {
      await ctx.reply('Оберіть прийом їжі з кнопок нижче:');
      return true;
    }
    const { food, amountG, calories } = st.data;
    await FoodHistory.create({ userId, foodId: food.id, amountG, calories, mealType: text, date: new Date() });
    stateStore.clear(telegramId);
    await ctx.reply(
      `✅ Записано!\n\n🍽 *${food.name}* — ${amountG} г\n🔥 ${calories} ккал\n📌 ${text}`,
      { parse_mode: 'Markdown', ...rmKeyboard }
    );
    return true;
  }

  return false;
}

module.exports = { handleFood };
