const { Telegraf } = require('telegraf');
const User = require('../models/User');
const { handleRegistration, DAYS, buildDaysKeyboard } = require('./handlers/registration');
const { handleCommands } = require('./handlers/commands');
const { handleExercise } = require('./handlers/exerciseHandler');
const { handleFood } = require('./handlers/foodHandler');
const userState = require('./state');

let bot;

function startBot() {
  bot = new Telegraf(process.env.BOT_TOKEN);

  // /start — entry point
  bot.start(async (ctx) => {
    const tgUser = ctx.from;
    let user = await User.findOne({ telegramId: tgUser.id });

    if (!user) {
      user = new User({
        telegramId: tgUser.id,
        username: tgUser.username || null,
        firstName: tgUser.first_name || null,
        lastName: tgUser.last_name || null,
        registrationStep: 'age',
        isRegistered: false,
      });
      await user.save({ validateBeforeSave: false });
    }

    if (user.isBlocked) {
      return ctx.reply('Ваш акаунт заблоковано. Зверніться до адміністратора.');
    }

    if (user.isRegistered) {
      return ctx.reply(
        `Вітаємо, ${tgUser.first_name}! Ви вже зареєстровані.\nВикористовуйте /help для списку команд.`
      );
    }

    await ctx.reply(
      `Вітаємо, ${tgUser.first_name}! 👋\n\nДля використання бота необхідно пройти реєстрацію.\n\nВведіть ваш вік (число від 1 до 120):`
    );
  });

  // Inline keyboard callbacks (training days selection)
  bot.on('callback_query', async (ctx) => {
    const tgUser = ctx.from;
    const data = ctx.callbackQuery.data;

    if (!data || !data.startsWith('td_')) return ctx.answerCbQuery();

    const user = await User.findOne({ telegramId: tgUser.id });
    if (!user || user.isBlocked || user.registrationStep !== 'training_days') {
      return ctx.answerCbQuery();
    }

    const current = userState.get(tgUser.id);
    const selectedDays = (current && current.data && current.data.selectedDays)
      ? [...current.data.selectedDays]
      : [];

    if (data === 'td_done') {
      if (selectedDays.length === 0) {
        return ctx.answerCbQuery('Оберіть хоча б один день тренування!');
      }
      userState.clear(tgUser.id);
      await User.updateOne(
        { _id: user._id },
        { trainingDays: selectedDays, registrationStep: 'training_time' }
      );
      await ctx.editMessageText(`Дні тренувань: ${selectedDays.join(', ')} ✅`);
      await ctx.reply('Вкажіть час тренувань у форматі ГГ:ХХ (наприклад: 18:00):');
      return ctx.answerCbQuery();
    }

    const day = data.slice(3);
    if (!DAYS.includes(day)) return ctx.answerCbQuery();

    const idx = selectedDays.indexOf(day);
    if (idx === -1) {
      selectedDays.push(day);
    } else {
      selectedDays.splice(idx, 1);
    }
    userState.set(tgUser.id, 'training_days_select', { selectedDays });

    try {
      await ctx.editMessageReplyMarkup(buildDaysKeyboard(selectedDays));
    } catch (_) {}
    return ctx.answerCbQuery();
  });

  // All text messages
  bot.on('text', async (ctx) => {
    const tgUser = ctx.from;
    const user = await User.findOne({ telegramId: tgUser.id });

    if (!user) {
      return ctx.reply('Введіть /start для початку роботи.');
    }
    if (user.isBlocked) {
      return ctx.reply('Ваш акаунт заблоковано. Зверніться до адміністратора.');
    }
    if (!user.isRegistered) {
      return handleRegistration(ctx, user);
    }

    const text = ctx.message.text;
    if (await handleExercise(ctx, user, text)) return;
    if (await handleFood(ctx, user, text)) return;

    return handleCommands(ctx, user);
  });

  bot.launch();
  console.log('Telegram bot started');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = { startBot };
