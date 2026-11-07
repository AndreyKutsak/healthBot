let _bot = null;

module.exports = {
  set(bot) { _bot = bot; },
  get() { return _bot; },
};
