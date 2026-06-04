const GOAL_LABEL = {
  weight_loss: 'Схуднення',
  muscle_gain: 'Набір маси',
  maintenance: 'Підтримка форми',
};

async function handleCommands(ctx, user) {
  const text = ctx.message.text;

  if (text === '/help') {
    return ctx.reply(
      '📋 Доступні команди:\n\n' +
      '/profile — переглянути ваш профіль\n' +
      '/log_exercise — записати тренування\n' +
      '/log_food — записати прийом їжі\n' +
      '/help — список команд'
    );
  }

  if (text === '/profile') {
    const genderLabel = user.gender === 'male' ? 'Чоловік' : 'Жінка';
    const trainingDays = user.trainingDays && user.trainingDays.length
      ? user.trainingDays.join(', ')
      : '—';
    const mealTimes = user.mealTimes && user.mealTimes.length
      ? user.mealTimes.join(', ')
      : '—';
    return ctx.reply(
      `👤 Ваш профіль:\n\n` +
      `• Вік: ${user.age} р.\n` +
      `• Стать: ${genderLabel}\n` +
      `• Вид спорту: ${user.sport}\n` +
      `• Зріст: ${user.height} см\n` +
      `• Вага: ${user.weight} кг\n` +
      `• Ціль: ${GOAL_LABEL[user.goal] || '—'}\n` +
      `• Дні тренувань: ${trainingDays}\n` +
      `• Час тренувань: ${user.trainingTime || '—'}\n` +
      `• Прийомів їжі на день: ${user.mealsPerDay || '—'}\n` +
      `• Час прийомів їжі: ${mealTimes}`
    );
  }

  return ctx.reply('Невідома команда. Використовуйте /help для списку команд.');
}

module.exports = { handleCommands };
