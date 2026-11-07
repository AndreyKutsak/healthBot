const { Telegraf } = require('telegraf');
const User = require('../models/User');
const { handleRegistration, DAYS, buildDaysKeyboard } = require('./handlers/registration');
const { handleCommands, BUTTON_ALIASES } = require('./handlers/commands');
const { handleExercise } = require('./handlers/exerciseHandler');
const { handleFood } = require('./handlers/foodHandler');
const { handleAI, clearHistory } = require('./handlers/aiHandler');
const { handleVoice } = require('./handlers/voiceHandler');
const { startCron } = require('./cron');
const userState = require('./state');
const botRef = require('./botRef');
const { MAIN_KEYBOARD } = require('./keyboard');

let bot;

function startBot() {
  bot = new Telegraf(process.env.BOT_TOKEN);
  botRef.set(bot);

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
      clearHistory(tgUser.id);
      return ctx.reply(
        `Вітаємо, ${tgUser.first_name}! 👋\n\n` +
        `Оберіть дію на клавіатурі або просто напишіть що ви їли чи яке тренування зробили — я все підрахую і запишу.`,
        MAIN_KEYBOARD
      );
    }

    await ctx.reply(
      `Вітаємо, ${tgUser.first_name}! 👋\n\nДля використання бота необхідно пройти реєстрацію.\n\nВведіть ваш вік (число від 1 до 120):`
    );
  });

  // Inline keyboard callbacks (training days selection during registration)
  bot.on('callback_query', async (ctx) => {
    const tgUser = ctx.from;
    const data = ctx.callbackQuery.data;

    if (!data || !data.startsWith('td_')) return ctx.answerCbQuery();

    const user = await User.findOne({ telegramId: tgUser.id });
    if (!user || user.isBlocked || user.registrationStep !== 'gym_days') {
      return ctx.answerCbQuery();
    }

    const current = userState.get(tgUser.id);
    const selectedDays = (current && current.data && current.data.selectedDays)
      ? [...current.data.selectedDays]
      : [];

    if (data === 'td_done') {
      if (selectedDays.length === 0) {
        return ctx.answerCbQuery('Оберіть хоча б один день!');
      }
      userState.clear(tgUser.id);
      await User.updateOne(
        { _id: user._id },
        { trainingDays: selectedDays, registrationStep: 'injuries' }
      );
      await ctx.editMessageText(`Дні в залі: ${selectedDays.join(', ')} ✅`);
      await ctx.reply(
        'Чи є у тебе травми або обмеження для тренувань?\n(Напиши "Немає" або опиши свої травми)',
        {
          reply_markup: {
            keyboard: [[{ text: 'Немає' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return ctx.answerCbQuery();
    }

    const day = data.slice(3);
    if (!DAYS.includes(day)) return ctx.answerCbQuery();

    const idx = selectedDays.indexOf(day);
    if (idx === -1) selectedDays.push(day);
    else selectedDays.splice(idx, 1);

    userState.set(tgUser.id, 'training_days_select', { selectedDays });

    try {
      await ctx.editMessageReplyMarkup(buildDaysKeyboard(selectedDays));
    } catch (_) {}
    return ctx.answerCbQuery();
  });

  // Voice messages → transcribe → AI
  bot.on('voice', async (ctx) => {
    const tgUser = ctx.from;
    const user = await User.findOne({ telegramId: tgUser.id });
    if (!user || user.isBlocked || !user.isRegistered) return;
    await handleVoice(ctx, user);
  });

  // All text messages
  bot.on('text', async (ctx) => {
    const tgUser = ctx.from;
    const user = await User.findOne({ telegramId: tgUser.id });

    if (!user) return ctx.reply('Введіть /start для початку роботи.');
    if (user.isBlocked) return ctx.reply('Ваш акаунт заблоковано. Зверніться до адміністратора.');

    // Registration flow
    if (!user.isRegistered) return handleRegistration(ctx, user);

    const text = ctx.message.text;

    // Mid-flow state handlers (for /log_exercise and /log_food command flows)
    if (await handleExercise(ctx, user, text)) return;
    if (await handleFood(ctx, user, text)) return;

    // Slash commands and main-keyboard buttons
    if (text.startsWith('/') || text in BUTTON_ALIASES) return handleCommands(ctx, user);

    // AI handles all free-form messages
    return handleAI(ctx, user);
  });

  bot.launch();
  console.log('Telegram bot started');

  // Menu button that opens the EMBER web app (Telegram requires an https URL)
  if (process.env.WEBAPP_URL) {
    bot.telegram
      .setChatMenuButton({
        menuButton: { type: 'web_app', text: 'Мій день', web_app: { url: process.env.WEBAPP_URL } },
      })
      .then(() => console.log(`Web app menu button: ${process.env.WEBAPP_URL}`))
      .catch((err) => console.error('Web app menu button error:', err.message));
  }

  startCron(bot);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = { startBot };
