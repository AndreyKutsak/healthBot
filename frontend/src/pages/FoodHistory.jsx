import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const MEAL_TYPES = ['Сніданок', 'Обід', 'Вечеря', 'Перекус'];
const LIMIT = 15;

export default function FoodHistory() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState('');
  const [mealFilter, setMealFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [users, setUsers] = useState([]);
  const [foods, setFoods] = useState([]);

  useEffect(() => {
    api.get('/users', { params: { limit: 200 } }).then(({ data }) => setUsers(data.users));
    api.get('/food', { params: { limit: 500 } }).then(({ data }) => setFoods(data.foods));
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (userFilter) params.userId = userFilter;
      if (mealFilter) params.mealType = mealFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get('/food-history', { params });
      setRecords(data.records);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, userFilter, mealFilter, from, to]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { setPage(1); }, [userFilter, mealFilter, from, to]);

  async function handleDelete() {
    await api.delete(`/food-history/${deleteTarget._id}`);
    setDeleteTarget(null);
    fetchRecords();
  }

  function formatDate(d) {
    return new Date(d).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
  }

  function userName(u) {
    if (!u) return '—';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || String(u.telegramId);
  }

  const mealBadgeClass = { 'Сніданок': 'active', 'Обід': 'male', 'Вечеря': 'active', 'Перекус': 'female' };

  return (
    <div className="page" style={{ padding: 0 }}>
      <div className="topbar">
        <h1>Історія харчування</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="topbar-user">Всього: {total}</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setModal({ mode: 'add', data: { userId: '', foodId: '', amountG: '', mealType: 'Сніданок', notes: '', date: '' } })}
          >+ Додати запис</button>
        </div>
      </div>

      <div style={{ padding: '28px' }}>
        <div className="table-card">
          <div className="table-toolbar">
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Всі користувачі</option>
              {users.map((u) => <option key={u._id} value={u._id}>{userName(u)}</option>)}
            </select>
            <select value={mealFilter} onChange={(e) => setMealFilter(e.target.value)}>
              <option value="">Всі прийоми їжі</option>
              {MEAL_TYPES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Від" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="До" />
          </div>

          {loading ? (
            <div className="loading">Завантаження...</div>
          ) : records.length === 0 ? (
            <div className="empty">Записів не знайдено</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Користувач</th>
                  <th>Продукт</th>
                  <th>Категорія</th>
                  <th>Прийом їжі</th>
                  <th>Кількість (г)</th>
                  <th>Калорії</th>
                  <th>Нотатки</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td>{formatDate(r.date)}</td>
                    <td>{userName(r.userId)}</td>
                    <td>
                      <strong>{r.foodId?.name ?? r.name ?? '—'}</strong>
                      {r.status === 'planned' && <span className="badge" style={{ marginLeft: 6 }}>план</span>}
                    </td>
                    <td>{r.foodId?.category
                      ? <span className="badge active">{r.foodId.category}</span>
                      : '—'}
                    </td>
                    <td>
                      <span className={`badge ${mealBadgeClass[r.mealType] || 'active'}`}>{r.mealType}</span>
                    </td>
                    <td>{r.amountG ? `${r.amountG} г` : '—'}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{r.approx ? '≈' : ''}{r.calories}</strong> ккал</td>
                    <td style={{ maxWidth: 140, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{r.notes || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setModal({ mode: 'edit', data: { ...r, userId: r.userId?._id, foodId: r.foodId?._id } })}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(r)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pages > 1 && (
            <div className="pagination">
              <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
              <span>{page} / {pages}</span>
              <button className="btn btn-outline btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <FoodHistoryModal
          mode={modal.mode}
          initial={modal.data}
          users={users}
          foods={foods}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchRecords(); }}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Видалити запис?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {deleteTarget.foodId?.name} — {formatDate(deleteTarget.date)}
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>Скасувати</button>
              <button className="btn btn-danger" onClick={handleDelete}>Видалити</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FoodHistoryModal({ mode, initial, users, foods, onClose, onSaved }) {
  const [form, setForm] = useState({ ...initial });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function userName(u) {
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || String(u.telegramId);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, amountG: Number(form.amountG) };
      if (mode === 'add') {
        await api.post('/food-history', payload);
      } else {
        await api.patch(`/food-history/${form._id}`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{mode === 'add' ? 'Новий запис харчування' : 'Редагувати запис'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label>Користувач</label>
          <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">— оберіть —</option>
            {users.map((u) => <option key={u._id} value={u._id}>{userName(u)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Продукт</label>
          <select value={form.foodId} onChange={(e) => setForm({ ...form, foodId: e.target.value })}>
            <option value="">— оберіть —</option>
            {foods.map((f) => <option key={f._id} value={f._id}>{f.name} ({f.caloriesPer100g} ккал/100г)</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Кількість (г)</label>
          <input type="number" min="1" value={form.amountG} onChange={(e) => setForm({ ...form, amountG: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Прийом їжі</label>
          <select value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value })}>
            {MEAL_TYPES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Дата</label>
          <input type="datetime-local" value={form.date ? new Date(form.date).toISOString().slice(0, 16) : ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Нотатки</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Скасувати</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
