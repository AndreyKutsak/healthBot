const crypto = require('crypto');
const User = require('../models/User');

// How long the Mini App launch data stays valid.
const MAX_AGE_SEC = 24 * 60 * 60;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

// Validates Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
// Returns the Telegram user object or null.
function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;

  try {
    return JSON.parse(params.get('user'));
  } catch {
    return null;
  }
}

// Personal API auth: the user is identified by the signed Telegram launch data.
// For local development without Telegram set DEV_TELEGRAM_ID in .env; it only
// works outside production and only for requests to localhost.
async function telegramAuth(req, res, next) {
  try {
    const initData = req.get('X-Telegram-Init-Data');
    let telegramId;

    if (initData) {
      const tgUser = verifyInitData(initData, process.env.BOT_TOKEN);
      if (!tgUser || !tgUser.id) {
        return res.status(401).json({ code: 'bad_signature', message: 'Сесія Telegram недійсна. Відкрийте застосунок з бота ще раз.' });
      }
      telegramId = tgUser.id;
    } else if (
      process.env.NODE_ENV !== 'production' &&
      process.env.DEV_TELEGRAM_ID &&
      LOCAL_HOSTS.includes(req.hostname)
    ) {
      telegramId = Number(process.env.DEV_TELEGRAM_ID);
    } else {
      return res.status(401).json({ code: 'no_telegram', message: 'Відкрийте застосунок через Telegram-бота.' });
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(403).json({ code: 'not_registered', message: 'Спершу запустіть бота командою /start.' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ code: 'blocked', message: 'Ваш акаунт заблоковано. Зверніться до адміністратора.' });
    }
    if (!user.isRegistered) {
      return res.status(403).json({ code: 'not_registered', message: 'Завершіть реєстрацію в боті, і тут з’являться ваші дані.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('telegramAuth error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = telegramAuth;
module.exports.verifyInitData = verifyInitData;
