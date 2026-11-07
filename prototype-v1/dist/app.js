// EMBER "Мій день" — main screen connected to the Health Bot backend (/api/me).
(() => {
  const api = window.EmberAPI;
  const { esc } = api;
  const $ = (s, root = document) => root.querySelector(s);
  const dialog = $('#dialog');
  const RING = 641;
  const GOALS = { weight_loss: 'Схуднення', muscle_gain: 'Набір маси', maintenance: 'Підтримка форми' };
  const QUALITY = { bad: 'Погано', ok: 'Нормально', good: 'Добре' };
  const WEEKDAY = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const SEND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v15"/></svg>';

  let profile = null;
  let day = null;
  let week = null;
  let quiet = false;
  let toastTimer;
  const chatLog = [];
  let chatBusy = false;

  const fmt = (n) => Math.round(n || 0).toLocaleString('uk-UA');
  const duration = (min) => `${Math.floor(min / 60)} год ${min % 60} хв`;
  const gramsOf = (n) => (n === null || n === undefined ? '—' : fmt(n));

  // ---------- dialog & toast ----------

  function show(html) {
    $('#dialogBody').innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  $('#close').onclick = () => dialog.close();
  dialog.addEventListener('click', (e) => {
    const r = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
  });

  function toast(s) {
    $('#toast').textContent = s;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3000);
  }

  // ---------- data ----------

  const today = () => api.localDate();
  const stamp = () => {
    $('#syncStatus').textContent = 'Оновлено о ' + new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  async function load() {
    try {
      [profile, day, week] = await Promise.all([
        api.get('/'),
        api.get(`/day?date=${today()}`),
        api.get(`/week?date=${today()}`),
      ]);
      render();
      stamp();
    } catch (e) {
      showLoadError(e);
    }
  }

  async function refresh() {
    try {
      [day, week] = await Promise.all([api.get(`/day?date=${today()}`), api.get(`/week?date=${today()}`)]);
      render();
      stamp();
    } catch (e) {
      toast(e.message);
    }
  }

  function showLoadError(e) {
    $('#syncStatus').textContent = 'Дані не завантажено';
    const title =
      e.code === 'not_registered' ? 'Майже готово' :
      e.code === 'blocked' ? 'Доступ обмежено' :
      e.status === 401 ? 'Відкрий через Telegram' : 'Не вдалося завантажити';
    const retry = e.status === 0 || e.status >= 500;
    show(`<span class="eyebrow">EMBER</span><h2>${esc(title)}</h2><p>${esc(e.message)}</p>` +
      (retry ? '<button class="primary" id="retry">Спробувати ще раз</button>' : ''));
    if (retry) $('#retry').onclick = () => { dialog.close(); load(); };
  }

  // ---------- main screen ----------

  function render() {
    const name = profile && profile.firstName ? profile.firstName.trim() : '';
    $('#greeting').textContent = name ? `Привіт, ${name}!` : 'Привіт, як ти?';
    $('#avatar').textContent = name ? name[0].toUpperCase() : 'Я';

    // nutrition ring
    const eaten = day.eaten;
    const norm = day.norm.calories;
    $('#cal').textContent = fmt(eaten.calories);
    $('#calNorm').textContent = norm ? `із ${fmt(norm)} ккал` : 'ккал сьогодні';
    $('#remaining').textContent = !norm ? 'Норму ще не розраховано' :
      eaten.calories <= norm ? `Ще ${fmt(norm - eaten.calories)} ккал до цілі` : `На ${fmt(eaten.calories - norm)} ккал понад ціль`;
    $('#ringProgress').style.strokeDashoffset = RING * (1 - Math.min(norm ? eaten.calories / norm : 0, 1));
    for (const k of ['protein', 'fat', 'carbs']) $('#' + k).innerHTML = `${fmt(eaten[k])} <small>г</small>`;

    // sleep
    if (day.sleep) {
      $('#sleepValue').textContent = duration(day.sleep.durationMin);
      $('#sleepQuality').textContent = QUALITY[day.sleep.quality] || '';
    } else {
      $('#sleepValue').textContent = 'Не записано';
      $('#sleepQuality').textContent = 'Додати';
    }

    // activity: calories burned today + last 7 days bars
    $('#burned').innerHTML = `${fmt(day.activity.burned)} <small>ккал</small>`;
    $('#burnedLabel').textContent = day.activity.minutes ? `спалено · ${day.activity.minutes} хв руху` : 'спалено сьогодні';
    const bars = [...$('#weekBars').children];
    const maxBurned = Math.max(1, ...week.days.map((d) => d.burned));
    week.days.forEach((d, i) => {
      if (!bars[i]) return;
      bars[i].style.height = Math.max(8, Math.round((d.burned / maxBurned) * 100)) + '%';
      bars[i].style.background = i === week.days.length - 1 ? 'linear-gradient(#bcd7ce,#a596c4)' : '#82748e55';
    });

    // workout of the day from the training plan
    const w = day.workout;
    if (!w) {
      $('#workoutValue').textContent = '—';
      $('#workoutName').textContent = 'Програми ще немає';
      $('#workoutPill').textContent = 'Попроси помічника';
    } else if (w.rest) {
      $('#workoutValue').textContent = 'Відпочинок';
      $('#workoutName').textContent = w.planName;
      $('#workoutPill').textContent = 'День відновлення';
    } else {
      const done = w.exercises.filter((e) => e.done).length;
      $('#workoutValue').innerHTML = `${done}/${w.exercises.length} <small>вправ</small>`;
      $('#workoutName').textContent = `${w.name} · ${w.planName}`;
      $('#workoutPill').textContent = done === w.exercises.length && done > 0 ? 'Виконано' : 'Коли будеш готовий';
    }
  }

  // ---------- add food ----------

  $('#add').onclick = openAddFood;

  async function openAddFood() {
    if (!day) return;
    show('<span class="eyebrow">ЗНАЙОМІ СТРАВИ</span><h2>Що сьогодні їв?</h2><p>Обери страви та перевір порцію.</p>' +
      '<label class="field">Пошук у базі<input id="foodSearch" type="search" placeholder="Наприклад, гречка" autocomplete="off" maxlength="60"></label>' +
      '<div id="foodList"><p>Завантаження…</p></div>' +
      '<button class="primary" id="confirmFood" disabled>Додати вибране</button>' +
      '<a class="secondary" href="/food/">Приблизно, наперед або своя страва →</a>');

    const chosen = new Map(); // foodId -> { food, grams }
    let recent = [];
    let shown = [];
    const list = $('#foodList');
    const confirm = $('#confirmFood');

    const kcal = (f, g) => Math.round((f.caloriesPer100g * g) / 100);
    const updateButton = () => {
      confirm.disabled = chosen.size === 0;
      confirm.textContent = chosen.size ? `Додати вибране (${chosen.size})` : 'Додати вибране';
    };

    function renderList(foods, emptyText) {
      shown = foods;
      if (!foods.length) { list.innerHTML = `<p>${esc(emptyText)}</p>`; return; }
      list.innerHTML = foods.map((f, i) => {
        const c = chosen.get(String(f.id));
        const g = c ? c.grams : f.lastAmountG || 100;
        return `<div class="food" data-i="${i}"><span class="food-name">${esc(f.name)}<small>${g} г · ${kcal(f, g)} ккал</small></span>` +
          `<span class="food-controls"><input class="grams" type="number" min="1" max="5000" step="1" value="${g}" aria-label="Порція, г"> г` +
          `<input type="checkbox" ${c ? 'checked' : ''} aria-label="Вибрати"></span></div>`;
      }).join('');
    }

    list.addEventListener('input', (e) => {
      const row = e.target.closest('.food');
      if (!row) return;
      const f = shown[+row.dataset.i];
      const gramsInput = $('.grams', row);
      const box = $('input[type=checkbox]', row);
      const g = Math.round(+gramsInput.value);
      if (e.target === gramsInput && g > 0) box.checked = true;
      $('small', row).textContent = `${g > 0 ? g : 0} г · ${g > 0 ? kcal(f, g) : 0} ккал`;
      if (box.checked && g > 0 && g <= 5000) chosen.set(String(f.id), { food: f, grams: g });
      else chosen.delete(String(f.id));
      updateButton();
    });
    list.addEventListener('click', (e) => {
      const name = e.target.closest('.food-name');
      if (!name) return;
      const box = $('input[type=checkbox]', name.parentElement);
      box.checked = !box.checked;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });

    let timer;
    $('#foodSearch').addEventListener('input', (e) => {
      clearTimeout(timer);
      const q = e.target.value.trim();
      if (q.length < 2) { renderList(recent, 'Ще немає записів. Знайди страву через пошук.'); return; }
      timer = setTimeout(async () => {
        try {
          const r = await api.get('/foods/search?q=' + encodeURIComponent(q));
          if ($('#foodSearch') && $('#foodSearch').value.trim() === q) {
            renderList(r.foods, 'У базі такого немає. Опиши страву помічнику або додай її приблизно в щоденнику.');
          }
        } catch (err) { toast(err.message); }
      }, 300);
    });

    confirm.onclick = async () => {
      confirm.disabled = true;
      try {
        const items = [...chosen.values()].map((c) => ({ foodId: c.food.id, amountG: c.grams }));
        await api.post('/food-entries', { items, date: new Date().toISOString(), mealType: api.mealTypeFor(), status: 'eaten' });
        dialog.close();
        toast(items.length > 1 ? `Додано ${items.length} страви` : 'Додано до щоденника');
        refresh();
      } catch (err) {
        toast(err.message);
        updateButton();
      }
    };

    try {
      recent = (await api.get('/foods/recent')).foods;
      renderList(recent, 'Ще немає записів. Знайди страву через пошук.');
    } catch (err) {
      list.innerHTML = `<p>${esc(err.message)}</p>`;
    }
  }

  // ---------- nutrition details ----------

  $('#nutrition').onclick = () => {
    if (!day) return;
    const e = day.eaten;
    const n = day.norm;
    const line = (label, v, normV) => `${label}: ${gramsOf(v)}${normV ? ` / ${fmt(normV)}` : ''} г`;
    const rows = (entries) => entries.map((x) =>
      `<div class="ex-row"><span>${esc(x.name)}<small>${esc(x.mealType)}${x.amountG ? ` · ${fmt(x.amountG)} г` : ''}</small></span><b>${x.approx ? '≈ ' : ''}${fmt(x.calories)} ккал</b></div>`
    ).join('');
    const eatenEntries = day.entries.filter((x) => x.status !== 'planned');
    const planned = day.entries.filter((x) => x.status === 'planned');
    show(`<span class="eyebrow">ХАРЧУВАННЯ · СЬОГОДНІ</span><h2>${fmt(e.calories)} ккал</h2>` +
      `<p>${n.calories ? `Денна ціль — ${fmt(n.calories)} ккал. Кільце показує частку записаних калорій.` : 'Денну норму ще не розраховано. Заверши профіль у боті.'}</p>` +
      `<div class="reply">${line('Білки', e.protein, n.protein)}\n${line('Жири', e.fat, n.fat)}\n${line('Вуглеводи', e.carbs, n.carbs)}` +
      `${e.incomplete ? '\nДля частини страв БЖВ невідомі.' : ''}${e.approx ? '\nЄ приблизні оцінки.' : ''}</div>` +
      (eatenEntries.length ? rows(eatenEntries) : '<p>Сьогодні ще нічого не записано.</p>') +
      (planned.length ? `<p class="note">У плані: ${fmt(day.planned.calories)} ккал — не входить у з’їдене.</p>${rows(planned)}` : '') +
      '<a class="secondary" href="/food/">Відкрити щоденник</a>');
  };

  // ---------- assistant ----------

  function chatFrame() {
    show('<span class="eyebrow">ПОМІЧНИК</span><h2>Я поруч.</h2><div id="chatLog"></div>' +
      `<form class="chat-form" id="chatForm"><input id="chatInput" placeholder="Напиши ще щось…" maxlength="1000" autocomplete="off" aria-label="Повідомлення помічнику"><button aria-label="Надіслати">${SEND_ICON}</button></form>` +
      `<button class="secondary" id="quiet">${quiet ? 'Повернути звичайний темп' : 'Увімкнути тихий день'}</button>` +
      '<p class="note">Помічник той самий, що в Telegram-боті: він може записати їжу чи тренування з твого повідомлення.</p>');
    $('#chatForm').onsubmit = (e) => {
      e.preventDefault();
      const text = $('#chatInput').value.trim();
      if (!text) return;
      $('#chatInput').value = '';
      sendChat(text);
    };
    $('#quiet').onclick = toggleQuiet;
    renderChatLog();
  }

  function renderChatLog() {
    const box = $('#chatLog');
    if (!box) return;
    box.innerHTML = chatLog.map((m) =>
      `<div class="reply ${m.role === 'me' ? 'me' : ''} ${m.pending ? 'pending' : ''} ${m.error ? 'error' : ''}">${m.pending ? 'Думаю…' : esc(m.text)}</div>`
    ).join('');
    box.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  async function sendChat(text, display = text) {
    if (chatBusy) { toast('Помічник ще відповідає'); return; }
    chatBusy = true;
    chatLog.push({ role: 'me', text: display });
    const answer = { role: 'bot', pending: true };
    chatLog.push(answer);
    while (chatLog.length > 30) chatLog.shift();
    if (!$('#chatLog')) chatFrame(); else renderChatLog();
    try {
      const r = await api.post('/chat', { text });
      answer.text = r.replies.join('\n\n') || 'Готово.';
      refresh(); // the assistant may have logged food or a workout
    } catch (e) {
      answer.text = e.message;
      answer.error = true;
    } finally {
      answer.pending = false;
      chatBusy = false;
      renderChatLog();
    }
  }

  $('#chat').onsubmit = (e) => {
    e.preventDefault();
    const text = $('#message').value.trim();
    if (!text) return;
    $('#message').value = '';
    sendChat(text);
  };

  $('#insight').onclick = () => sendChat(
    'Підсумуй мій сьогоднішній день коротко: що вдалося і на що звернути увагу. Нічого не записуй і не створюй сповіщень.',
    'Як проходить мій день?'
  );

  function toggleQuiet() {
    quiet = !quiet;
    document.body.dataset.quiet = String(quiet);
    $('#companionTitle').textContent = quiet ? 'Сьогодні можна повільніше.' : 'У твоєму темпі.';
    $('#companionText').textContent = quiet ? 'Залишимо тільки найважливіше' : 'Погляньмо, як проходить день';
    dialog.close();
    toast(quiet ? 'Тихий день увімкнено' : 'Звичайний темп');
  }

  // ---------- workout ----------

  $('#workout').onclick = openWorkout;

  function openWorkout() {
    if (!day) return;
    const w = day.workout;
    if (!w) {
      show('<span class="eyebrow">ТРЕНУВАННЯ</span><h2>Програми ще немає.</h2><p>Помічник складе її з урахуванням твоєї цілі, досвіду й обмежень.</p>' +
        '<button class="primary" id="askPlan">Попросити скласти програму</button>');
      $('#askPlan').onclick = () => sendChat('Склади мені програму тренувань');
      return;
    }
    if (w.rest) {
      show(`<span class="eyebrow">${esc(w.planName.toUpperCase())}</span><h2>Сьогодні відпочинок.</h2>` +
        '<p>За програмою сьогодні немає тренування. Якщо все ж займався — розкажи помічнику, він запише.</p>' + activityRows());
      return;
    }
    show(`<span class="eyebrow">${esc(w.planName.toUpperCase())}</span><h2>${esc(w.name)}</h2>` +
      '<p>Відмічай вправу, коли закінчиш усі підходи. Запис потрапить у твою історію так само, як через бота.</p>' +
      w.exercises.map((e, i) => {
        const plan = [e.sets && e.reps ? `${e.sets}×${e.reps}` : '', e.durationMin ? `${e.durationMin} хв` : '', e.restSec ? `відпочинок ${e.restSec} с` : '']
          .filter(Boolean).join(' · ');
        return `<div class="ex-row"><span>${esc(e.name)}<small>${esc(plan || e.notes || 'За самопочуттям')}</small></span>` +
          `<button data-i="${i}" ${e.done ? 'disabled' : ''}>${e.done ? 'Відмічено ✓' : 'Виконано'}</button></div>`;
      }).join(''));
    $('#dialogBody').querySelectorAll('.ex-row button').forEach((btn) => {
      btn.onclick = async () => {
        const e = w.exercises[+btn.dataset.i];
        btn.disabled = true;
        btn.textContent = 'Записую…';
        try {
          const r = await api.post('/workout/log', { exerciseName: e.name, sets: e.sets, reps: e.reps, durationMin: e.durationMin });
          btn.textContent = 'Відмічено ✓';
          toast(r.caloriesBurned ? `Записано · ${r.caloriesBurned} ккал` : 'Записано');
          refresh();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Виконано';
          toast(err.message);
        }
      };
    });
  }

  function activityRows() {
    const list = day.activity.exercises;
    if (!list.length) return '<p>Сьогодні тренувань ще не записано.</p>';
    return list.map((x) => {
      const info = [x.sets && x.reps ? `${x.sets}×${x.reps}` : '', x.weightKg ? `${x.weightKg} кг` : '', x.durationMin ? `${x.durationMin} хв` : '']
        .filter(Boolean).join(' · ');
      return `<div class="ex-row"><span>${esc(x.name)}<small>${esc(info || '—')}</small></span><b>${fmt(x.caloriesBurned)} ккал</b></div>`;
    }).join('');
  }

  // ---------- sleep ----------

  function openSleep() {
    if (!day) return;
    const cur = day.sleep;
    let quality = cur ? cur.quality : null;
    const h = cur ? Math.floor(cur.durationMin / 60) : 7;
    const m = cur ? cur.durationMin % 60 : 30;
    show('<span class="eyebrow">СОН · МИНУЛА НІЧ</span><h2>Як ти спав?</h2><p>Запиши приблизно, точність до хвилини не потрібна.</p>' +
      `<div class="field-row"><label class="field">Години<input id="sleepH" type="number" min="0" max="24" value="${h}"></label>` +
      `<label class="field">Хвилини<input id="sleepM" type="number" min="0" max="59" step="5" value="${m}"></label></div>` +
      '<span class="field">Самопочуття</span><div class="seg" id="sleepQ">' +
      Object.entries(QUALITY).map(([k, v]) => `<button type="button" data-q="${k}" aria-pressed="${k === quality}">${v}</button>`).join('') +
      '</div><button class="primary" id="saveSleep">Зберегти</button>' +
      '<p class="note">Дані телефона чи годинника не зчитуються — лише те, що вносиш сам.</p>');
    $('#sleepQ').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      quality = b.dataset.q;
      $('#sleepQ').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    };
    $('#saveSleep').onclick = async () => {
      const total = Math.round(+$('#sleepH').value) * 60 + Math.round(+$('#sleepM').value);
      if (!Number.isFinite(total) || total < 0 || total > 1440) { toast('Перевір години й хвилини'); return; }
      $('#saveSleep').disabled = true;
      try {
        await api.put('/sleep', { date: today(), durationMin: total, quality });
        dialog.close();
        toast('Сон записано');
        refresh();
      } catch (err) {
        $('#saveSleep').disabled = false;
        toast(err.message);
      }
    };
  }

  // ---------- panels ----------

  function openProgress() {
    if (!week) return;
    const norm = week.norm.calories;
    const max = Math.max(1, norm || 0, ...week.days.map((d) => d.eaten));
    const avg = Math.round(week.days.reduce((s, d) => s + d.eaten, 0) / week.days.length);
    const burned = week.days.reduce((s, d) => s + d.burned, 0);
    show('<span class="eyebrow">ПРОГРЕС · 7 ДНІВ</span><h2>Твій тиждень</h2>' +
      `<p>Середнє за день: ${fmt(avg)} ккал${norm ? ` при цілі ${fmt(norm)}` : ''}. Спалено за тиждень: ${fmt(burned)} ккал.</p>` +
      '<div class="week-chart">' + week.days.map((d, i) => {
        const wd = WEEKDAY[new Date(d.date + 'T12:00').getDay()];
        const cls = [i === week.days.length - 1 ? 'today' : '', norm && d.eaten > norm ? 'over' : ''].join(' ');
        return `<div class="${cls}" title="${fmt(d.eaten)} ккал"><span>${d.eaten ? fmt(d.eaten) : ''}</span><i style="height:${Math.round((d.eaten / max) * 100)}%"></i>${wd}</div>`;
      }).join('') + '</div>' +
      `<div class="reply">Вага: ${profile.weight ? `${profile.weight} кг` : '—'}\nЦіль: ${esc(GOALS[profile.goal] || '—')}</div>` +
      '<p class="note">Історії ваги та замірів поки немає. Нову вагу можна сказати помічнику, і норма перерахується.</p>');
  }

  function openProfile() {
    if (!profile) return;
    const p = profile;
    const n = p.norm;
    const rows = [
      ['Вік', p.age && `${p.age}`],
      ['Зріст', p.height && `${p.height} см`],
      ['Вага', p.weight && `${p.weight} кг`],
      ['Ціль', GOALS[p.goal]],
      ['Норма', n.calories && `${fmt(n.calories)} ккал · Б ${n.protein ?? '—'} / Ж ${n.fat ?? '—'} / В ${n.carbs ?? '—'} г`],
      ['Дні в залі', p.trainingDays && p.trainingDays.length ? p.trainingDays.join(', ') : null],
      ['Обмеження', p.foodRestrictions],
      ['Травми', p.injuries],
    ].filter(([, v]) => v);
    show(`<span class="eyebrow">ПРОФІЛЬ</span><h2>${esc(p.firstName || 'Мій профіль')}</h2>` +
      rows.map(([k, v]) => `<div class="ex-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('') +
      '<p class="note">Щоб змінити дані, напиши помічнику, наприклад: «моя вага тепер 78 кг».</p>' +
      '<p class="note">Нейронний фон — художня анімація, він не відображає стан мозку чи серця.</p>');
  }

  function panel(name) {
    if (name === 'Більше') {
      show('<span class="eyebrow">ТВІЙ ПРОСТІР</span><h2>Більше можливостей</h2>' +
        '<a class="menu-option" href="/food/">Щоденник їжі<small>Приблизні записи, план наперед, своя страва</small></a>' +
        '<button class="menu-option" id="moreSleep">Сон<small>Записати минулу ніч</small></button>' +
        '<button class="menu-option" id="moreWorkout">Тренування<small>Вправи на сьогодні за програмою</small></button>' +
        '<button class="menu-option" id="moreProgress">Прогрес<small>Калорії за тиждень</small></button>' +
        '<a class="menu-option" href="/palettes/">Кольори<small>23 палітри оформлення</small></a>' +
        '<button class="menu-option" id="moreProfile">Профіль<small>Твої дані та норма</small></button>');
      $('#moreSleep').onclick = openSleep;
      $('#moreWorkout').onclick = openWorkout;
      $('#moreProgress').onclick = openProgress;
      $('#moreProfile').onclick = openProfile;
      return;
    }
    if (name === 'Сон') return openSleep();
    if (name === 'Прогрес') return openProgress();
    if (name === 'Профіль') return openProfile();
    if (name === 'Активність') {
      if (!day) return;
      return show(`<span class="eyebrow">РУХ · СЬОГОДНІ</span><h2>${fmt(day.activity.burned)} ккал</h2>` +
        `<p>${day.activity.minutes ? `${day.activity.minutes} хв тренувань. ` : ''}Стовпчики на картці — спалені калорії за останні 7 днів. Кроки з телефона поки не зчитуються.</p>` +
        activityRows());
    }
  }

  document.querySelectorAll('[data-panel]').forEach((el) => { el.onclick = () => panel(el.dataset.panel); });
  $('#home').onclick = () => {
    dialog.close();
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  // refresh when the app comes back to the foreground (e.g. after logging in the bot)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && day) refresh(); });

  load();
})();
