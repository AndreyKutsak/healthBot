const userStates = new Map();

module.exports = {
  get: (telegramId) => userStates.get(telegramId) || null,
  set: (telegramId, state, data = {}) => userStates.set(telegramId, { state, data }),
  clear: (telegramId) => userStates.delete(telegramId),
};
