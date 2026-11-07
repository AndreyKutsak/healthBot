// EMBER client for the personal backend API (/api/me). Shared by all pages.
(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  const initData = (tg && tg.initData) || '';
  if (tg && initData) {
    try {
      tg.ready();
      tg.expand();
      const color = document.querySelector('meta[name="theme-color"]')?.content;
      if (color) { tg.setHeaderColor(color); tg.setBackgroundColor(color); }
    } catch { /* older Telegram clients */ }
  }

  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  const tz = new Date().getTimezoneOffset();

  async function request(method, path, body) {
    const headers = {};
    if (initData) headers['X-Telegram-Init-Data'] = initData;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const sep = path.includes('?') ? '&' : '?';
    let res;
    try {
      res = await fetch(`/api/me${path}${sep}tz=${tz}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Немає зв’язку з сервером. Перевір інтернет і спробуй ще раз.', 0);
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw new ApiError((data && data.message) || 'Помилка сервера', res.status, data && data.code);
    return data;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // "YYYY-MM-DD" -> ISO moment: today = now, other days = local noon
  function dateToISO(s) {
    if (!s || s === localDate()) return new Date().toISOString();
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toISOString();
  }

  function mealTypeFor(d = new Date()) {
    const h = d.getHours();
    if (h >= 5 && h < 11) return 'Сніданок';
    if (h >= 11 && h < 16) return 'Обід';
    if (h >= 16 && h < 21) return 'Вечеря';
    return 'Перекус';
  }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.EmberAPI = {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b ?? {}),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    put: (p, b) => request('PUT', p, b ?? {}),
    del: (p) => request('DELETE', p),
    tz,
    localDate,
    dateToISO,
    mealTypeFor,
    esc,
    inTelegram: !!initData,
    MEAL_TYPES: ['Сніданок', 'Обід', 'Вечеря', 'Перекус'],
  };
})();
