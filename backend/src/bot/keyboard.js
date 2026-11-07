const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: '🏋️ Тренування' }, { text: '🍎 Їжа' }],
      [{ text: '📊 Статистика' }, { text: '📋 Моя програма' }],
      [{ text: '👤 Профіль' },    { text: 'ℹ️ Допомога' }],
    ],
    resize_keyboard: true,
    persistent: true,
  },
};

module.exports = { MAIN_KEYBOARD };
