// EMBER Food Lab — food journal connected to the Health Bot backend (/api/me).
(() => {
  const api = window.EmberAPI;
  const q = (s, root = document) => root.querySelector(s);
  const scenarios = ['Знайома страва', 'Своя страва', 'Приблизно', 'Усе ввечері', 'Обід наперед'];
  const hints = [
    'Знайди страву в базі або обери з недавніх. Зміни лише порцію.',
    'Страви немає в базі? Вкажи її калорії та БЖВ на всю порцію. Запис не змінить загальну базу.',
    'Коли грамів немає, можна зберегти власну приблизну оцінку.',
    'Внеси все з’їдене за день одним пакетом. Порожні рядки не зберігаються.',
    'Обід зранку залишається планом, поки ти не підтвердиш, що поїв.',
  ];

  let mode = 0;
  let editing = null;
  let deleted = null;
  let recent = [];
  let pickList = [];   // foods shown in the single-food picker
  let batch = [];      // foods shown in the batch list
  let journal = null;  // last /day response
  let busy = false;

  const kcalOf = (f, g) => Math.round(((f.caloriesPer100g || 0) * g) / 100);
  const fmt = (n) => Math.round(n || 0).toLocaleString('uk-UA');

  function toast(t) {
    q('#toast').textContent = t;
    q('#toast').classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => q('#toast').classList.remove('show'), 3500);
  }

  function node(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function labelled(text, input) {
    const l = node('label', text);
    l.append(input);
    return l;
  }

  function input(id, attrs = {}) {
    const i = node('input');
    i.id = id;
    Object.entries(attrs).forEach(([k, v]) => i.setAttribute(k, v));
    return i;
  }

  const portion = (id, value, required = true) =>
    labelled('Порція, г', input(id, { type: 'number', min: 1, max: 5000, step: 1, value, ...(required ? { required: '' } : {}) }));

  // ---------- food search ----------

  async function searchFoods(text) {
    const s = text.trim();
    if (s.length < 2) return null;
    try {
      return (await api.get('/foods/search?q=' + encodeURIComponent(s))).foods;
    } catch (e) {
      toast(e.message);
      return [];
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function fillPicker(foods, keepId) {
    pickList = foods;
    const sel = q('#food');
    if (!sel) return;
    sel.replaceChildren();
    if (!foods.length) {
      const o = node('option', 'Знайди страву через пошук');
      o.value = '';
      o.disabled = true;
      o.selected = true;
      sel.append(o);
    }
    foods.forEach((f, i) => {
      const o = node('option', `${f.name} · ${fmt(f.caloriesPer100g)} ккал / 100 г`);
      o.value = String(i);
      if (String(f.id) === String(keepId)) o.selected = true;
      sel.append(o);
    });
    preview();
  }

  function selectedFood() {
    const v = q('#food')?.value;
    return v === '' || v === undefined ? null : pickList[+v] || null;
  }

  function renderBatch() {
    const box = q('#batch-rows');
    if (!box) return;
    const values = new Map([...box.querySelectorAll('input')].map((i) => [i.dataset.id, i.value]));
    box.replaceChildren();
    if (!batch.length) box.append(node('p', 'Недавніх страв ще немає. Додай їх через пошук вище.', 'muted'));
    batch.forEach((f) => {
      const row = node('div', undefined, 'batch-row');
      const g = input('batch-' + f.id, { type: 'number', min: 1, max: 5000, step: 1, placeholder: 'г', 'aria-label': `${f.name}, грамів` });
      g.dataset.id = String(f.id);
      g.value = values.get(String(f.id)) ?? '';
      const name = node('span', f.name);
      name.append(node('small', ` · ${fmt(f.caloriesPer100g)} ккал / 100 г`, 'muted'));
      row.append(name, labelled('', g));
      box.append(row);
    });
    preview();
  }

  // ---------- entry form ----------

  function choose(i) {
    mode = i;
    editing = null;
    q('#cancel').hidden = true;
    q('#save').textContent = 'Зберегти запис';
    q('#scenario-title').textContent = scenarios[i];
    q('#hint').textContent = hints[i];
    q('#date').value = api.localDate();
    q('#state').value = i === 4 ? 'planned' : 'eaten';
    q('#meal').value = i === 4 ? 'Обід' : api.mealTypeFor();
    q('#state').disabled = false;
    const f = q('#fields');
    f.replaceChildren();

    if (i === 0 || i === 4) {
      const search = input('food-search', { type: 'search', placeholder: 'Почни вводити назву', autocomplete: 'off', maxlength: 60 });
      const sel = node('select');
      sel.id = 'food';
      sel.required = true;
      f.append(labelled('Пошук у базі', search), labelled('Страва', sel), portion('grams', 100));
      search.addEventListener('input', debounce(async () => {
        const found = await searchFoods(search.value);
        fillPicker(found === null ? recent : found, selectedFood()?.id);
      }, 300));
      sel.addEventListener('change', () => {
        const food = selectedFood();
        if (food && food.lastAmountG) q('#grams').value = food.lastAmountG;
        preview();
      });
      fillPicker(recent);
      const first = selectedFood();
      if (first && first.lastAmountG) q('#grams').value = first.lastAmountG;
    } else if (i === 1) {
      f.append(
        labelled('Назва', input('food-name', { maxlength: 100, required: '', placeholder: 'Наприклад, сирна запіканка з йогуртом' })),
        portion('grams', '', false),
        labelled('Калорії на порцію', input('kcal', { type: 'number', min: 0, max: 10000, required: '' })),
      );
      const grid = node('div', undefined, 'form-grid');
      grid.append(
        labelled('Білки, г', input('protein', { type: 'number', min: 0, max: 2000 })),
        labelled('Жири, г', input('fat', { type: 'number', min: 0, max: 2000 })),
        labelled('Вуглеводи, г', input('carbs', { type: 'number', min: 0, max: 2000 })),
      );
      f.append(grid, node('p', 'Порожнє поле БЖВ — «невідомо», а не нуль.', 'muted'));
    } else if (i === 2) {
      f.append(
        labelled('Що їв', input('food-name', { value: 'Замовлений обід', maxlength: 100, required: '' })),
        labelled('Опис порції', input('portion-note', { value: 'Одна середня порція', maxlength: 120 })),
        labelled('Твоя оцінка калорій', input('estimate', { type: 'number', min: 1, max: 10000, value: 650, required: '' })),
        node('p', 'БЖВ невідомі — у підсумку позначимо їх як неповні.', 'muted'),
      );
    } else if (i === 3) {
      const search = input('batch-search', { type: 'search', placeholder: 'Додати страву з бази', autocomplete: 'off', maxlength: 60 });
      const results = node('div', undefined, 'choices');
      results.id = 'batch-results';
      const rows = node('div');
      rows.id = 'batch-rows';
      f.append(labelled('Пошук у базі', search), results, rows);
      search.addEventListener('input', debounce(async () => {
        const found = (await searchFoods(search.value)) || [];
        results.replaceChildren();
        found.filter((x) => !batch.some((b) => String(b.id) === String(x.id))).slice(0, 6).forEach((x) => {
          const b = node('button', '+ ' + x.name);
          b.type = 'button';
          b.onclick = () => {
            batch.push(x);
            b.remove();
            renderBatch();
            q('#batch-' + x.id)?.focus();
          };
          results.append(b);
        });
      }, 300));
      batch = recent.slice(0, 6);
      renderBatch();
    }

    document.querySelectorAll('[data-scenario]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.scenario === i)));
    preview();
  }

  const val = (id) => q('#' + id)?.value.trim() ?? '';

  // Items to send for the current scenario (null when the form is not ready).
  function draft() {
    if (mode === 0 || mode === 4) {
      const f = selectedFood();
      const g = +val('grams');
      return f && g > 0 ? [{ item: { foodId: f.id, amountG: g }, kcal: kcalOf(f, g) }] : null;
    }
    if (mode === 1) {
      const kcal = +val('kcal');
      const name = val('food-name');
      if (!name || val('kcal') === '' || !(kcal >= 0)) return null;
      return [{ item: { name, calories: kcal, amountG: val('grams') || null, protein: val('protein'), fat: val('fat'), carbs: val('carbs') }, kcal }];
    }
    if (mode === 2) {
      const kcal = +val('estimate');
      const name = val('food-name');
      return name && kcal > 0 ? [{ item: { name, calories: kcal, approx: true, notes: val('portion-note') }, kcal, approx: true }] : null;
    }
    const rows = batch
      .map((f) => ({ f, g: +(q('#batch-' + f.id)?.value || 0) }))
      .filter((r) => r.g > 0)
      .map((r) => ({ item: { foodId: r.f.id, amountG: r.g }, kcal: kcalOf(r.f, r.g) }));
    return rows.length ? rows : null;
  }

  function preview() {
    if (editing) return;
    const rows = draft();
    const k = rows ? rows.reduce((a, r) => a + r.kcal, 0) : 0;
    const where = q('#state').value === 'planned' ? 'До плану' : 'До з’їденого';
    const tail = mode === 2 ? ' · приблизно · БЖВ невідомі' : mode === 1 ? ' · за твоїми даними' : ' · за базою продуктів';
    q('#preview').textContent = rows ? `${where}: ${fmt(k)} ккал${rows.length > 1 ? ` · ${rows.length} страв` : ''}${tail}` : 'Заповни поля, щоб побачити підсумок.';
  }

  function edit(r) {
    editing = r;
    q('#scenario-title').textContent = 'Змінити запис';
    q('#hint').textContent = `${r.name} · зміна стосується тільки цього запису.`;
    const f = q('#fields');
    f.replaceChildren();
    const byGrams = !!r.amountG;
    const field = input('edit-value', { type: 'number', min: byGrams ? 1 : 0, max: byGrams ? 5000 : 10000, required: '', value: byGrams ? r.amountG : r.calories });
    f.append(labelled(byGrams ? 'Порція, г' : 'Калорії', field));
    q('#date').value = api.localDate(new Date(r.date));
    q('#state').value = r.status;
    q('#meal').value = r.mealType;
    q('#preview').textContent = `${r.name}: ${r.approx ? '≈ ' : ''}${fmt(r.calories)} ккал`;
    q('#save').textContent = 'Зберегти зміни';
    q('#cancel').hidden = false;
    q('#entry').scrollIntoView({ block: 'start' });
    field.focus();
  }

  q('#entry').addEventListener('input', preview);
  q('#entry').addEventListener('change', preview);
  q('#cancel').onclick = () => choose(mode);

  q('#entry').onsubmit = async (e) => {
    e.preventDefault();
    if (busy || !q('#entry').reportValidity()) return;
    const date = q('#date').value;
    busy = true;
    q('#save').disabled = true;
    try {
      if (editing) {
        const n = +q('#edit-value').value;
        const body = { status: q('#state').value, mealType: q('#meal').value };
        body[editing.amountG ? 'amountG' : 'calories'] = n;
        if (date !== api.localDate(new Date(editing.date))) body.date = api.dateToISO(date);
        await api.patch('/food-entries/' + editing.id, body);
        toast('Зміни збережено.');
      } else {
        const rows = draft();
        if (!rows) { toast('Заповни поля запису'); return; }
        await api.post('/food-entries', {
          items: rows.map((r) => r.item),
          date: api.dateToISO(date),
          mealType: q('#meal').value,
          status: q('#state').value,
        });
        toast(rows.length > 1 ? `Збережено ${rows.length} страв.` : 'Збережено.');
        refreshRecent();
      }
      q('#journal-date').value = date;
      choose(mode);
      await render();
    } catch (err) {
      toast(err.message);
    } finally {
      busy = false;
      q('#save').disabled = false;
    }
  };

  // ---------- journal ----------

  async function render() {
    const date = q('#journal-date').value || api.localDate();
    try {
      journal = await api.get('/day?date=' + date);
    } catch (e) {
      q('#totals').textContent = e.message;
      q('#entries').replaceChildren();
      return;
    }
    if ((q('#journal-date').value || api.localDate()) !== date) return; // another date was picked meanwhile
    const t = journal.eaten;
    const norm = journal.norm.calories;
    q('#totals').textContent =
      `З’їдено: ${fmt(t.calories)}${norm ? ` із ${fmt(norm)}` : ''} ккал · Б ${fmt(t.protein)} / Ж ${fmt(t.fat)} / В ${fmt(t.carbs)} г. ` +
      `У плані: ${fmt(journal.planned.calories)} ккал.` +
      (t.incomplete ? ' БЖВ неповні: є страви без цих даних.' : '') +
      (t.approx ? ' Є приблизні оцінки.' : '');

    const list = q('#entries');
    list.replaceChildren();
    if (!journal.entries.length) list.append(node('p', 'Поки порожньо. Додай першу страву вище.'));
    for (const r of journal.entries) {
      const row = node('article', undefined, 'entry-row');
      const portionText = r.amountG ? `${fmt(r.amountG)} г` : r.notes || 'Порція';
      const m = (v) => (v === null || v === undefined ? '—' : fmt(v));
      const macros = r.protein == null && r.fat == null && r.carbs == null
        ? 'БЖВ невідомі'
        : `Б ${m(r.protein)} / Ж ${m(r.fat)} / В ${m(r.carbs)} г`;
      row.append(
        node('h3', r.name),
        node('p', `${r.status === 'planned' ? 'Заплановано' : 'З’їдено'} · ${r.mealType} · ${portionText} · ${r.approx ? '≈ ' : ''}${fmt(r.calories)} ккал · ${macros}`),
      );
      const actions = node('div', undefined, 'actions');
      const button = (label, fn) => {
        const b = node('button', label);
        b.type = 'button';
        b.onclick = async () => {
          b.disabled = true;
          try { await fn(); } catch (err) { toast(err.message); } finally { b.disabled = false; }
        };
        actions.append(b);
      };
      if (r.status === 'planned') {
        button('Я це з’їв', async () => {
          await api.patch('/food-entries/' + r.id, { status: 'eaten' });
          toast('План підтверджено. Підсумок оновлений.');
          await render();
        });
      }
      button('Змінити', async () => edit(r));
      button('Видалити', async () => {
        const res = await api.del('/food-entries/' + r.id);
        deleted = res.entry;
        q('#undo').hidden = false;
        if (editing && editing.id === r.id) choose(mode);
        await render();
      });
      row.append(actions);
      list.append(row);
    }
  }

  q('#undo').onclick = async () => {
    if (!deleted) return;
    const e = deleted;
    const item = e.foodId
      ? { foodId: e.foodId, amountG: e.amountG, notes: e.notes }
      : { name: e.name, calories: e.calories, amountG: e.amountG, protein: e.protein, fat: e.fat, carbs: e.carbs, approx: e.approx, notes: e.notes };
    q('#undo').disabled = true;
    try {
      await api.post('/food-entries', { items: [item], date: e.date, mealType: e.mealType, status: e.status });
      deleted = null;
      q('#undo').hidden = true;
      toast('Запис повернуто.');
      await render();
    } catch (err) {
      toast(err.message);
    } finally {
      q('#undo').disabled = false;
    }
  };

  q('#journal-date').value = api.localDate();
  q('#journal-date').onchange = render;

  // ---------- start ----------

  async function refreshRecent() {
    try {
      recent = (await api.get('/foods/recent')).foods;
    } catch { /* keep previous */ }
  }

  // meal type select next to date and state
  const meal = node('select');
  meal.id = 'meal';
  api.MEAL_TYPES.forEach((m) => { const o = node('option', m); o.value = m; meal.append(o); });
  q('#meta-grid').append(labelled('Прийом їжі', meal));

  scenarios.forEach((name, i) => {
    const b = node('button', name);
    b.type = 'button';
    b.dataset.scenario = i;
    b.onclick = () => choose(i);
    q('#scenarios').append(b);
  });
  q('#about').onclick = () => toast('Записи зберігаються в Health Bot: їх видно в боті, на головній і в адмінці.');
  q('#home').onclick = () => { location.href = '/'; };

  (async () => {
    try {
      await api.get('/');
    } catch (e) {
      q('#totals').textContent = e.message;
      q('#save').disabled = true;
      toast(e.message);
      return;
    }
    await refreshRecent();
    choose(0);
    await render();
  })();
})();
