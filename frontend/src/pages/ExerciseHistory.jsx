import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const LIMIT = 15;

export default function ExerciseHistory() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [users, setUsers] = useState([]);
  const [exercises, setExercises] = useState([]);

  // load selects once
  useEffect(() => {
    api.get('/users', { params: { limit: 200 } }).then(({ data }) => setUsers(data.users));
    api.get('/exercises', { params: { limit: 200 } }).then(({ data }) => setExercises(data.exercises));
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (userFilter) params.userId = userFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get('/exercise-history', { params });
      setRecords(data.records);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, userFilter, from, to]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { setPage(1); }, [userFilter, from, to]);

  async function handleDelete() {
    await api.delete(`/exercise-history/${deleteTarget._id}`);
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

  return (
    <div className="page" style={{ padding: 0 }}>
      <div className="topbar">
        <h1>Історія тренувань</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="topbar-user">Всього: {total}</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setModal({ mode: 'add', data: { userId: '', exerciseId: '', sets: '', reps: '', weightKg: '', durationMin: '', notes: '', date: '' } })}
          >+ Додати запис</button>
        </div>
      </div>

      <div style={{ padding: '28px' }}>
        <div className="table-card">
          <div className="table-toolbar">
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Всі користувачі</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>{userName(u)}</option>
              ))}
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
                  <th>Вправа</th>
                  <th>Категорія</th>
                  <th>Підходи</th>
                  <th>Повтори</th>
                  <th>Вага (кг)</th>
                  <th>Тривалість (хв)</th>
                  <th>Нотатки</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td>{formatDate(r.date)}</td>
                    <td>{userName(r.userId)}</td>
                    <td><strong>{r.exerciseId?.name ?? '—'}</strong></td>
                    <td>{r.exerciseId?.category
                      ? <span className="badge active">{r.exerciseId.category}</span>
                      : '—'}
                    </td>
                    <td>{r.sets ?? '—'}</td>
                    <td>{r.reps ?? '—'}</td>
                    <td>{r.weightKg ?? '—'}</td>
                    <td>{r.durationMin ?? '—'}</td>
                    <td style={{ maxWidth: 160, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{r.notes || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setModal({ mode: 'edit', data: { ...r, userId: r.userId?._id, exerciseId: r.exerciseId?._id } })}>✏️</button>
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
        <ExHistoryModal
          mode={modal.mode}
          initial={modal.data}
          users={users}
          exercises={exercises}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchRecords(); }}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Видалити запис?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {deleteTarget.exerciseId?.name} — {formatDate(deleteTarget.date)}
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

function ExHistoryModal({ mode, initial, users, exercises, onClose, onSaved }) {
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
      const payload = { ...form };
      ['sets', 'reps', 'weightKg', 'durationMin'].forEach((k) => {
        if (payload[k] === '' || payload[k] === null) payload[k] = null;
        else payload[k] = Number(payload[k]);
      });
      if (mode === 'add') {
        await api.post('/exercise-history', payload);
      } else {
        await api.patch(`/exercise-history/${form._id}`, payload);
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
        <h2>{mode === 'add' ? 'Новий запис тренування' : 'Редагувати запис'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label>Користувач</label>
          <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">— оберіть —</option>
            {users.map((u) => <option key={u._id} value={u._id}>{userName(u)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Вправа</label>
          <select value={form.exerciseId} onChange={(e) => setForm({ ...form, exerciseId: e.target.value })}>
            <option value="">— оберіть —</option>
            {exercises.map((ex) => <option key={ex._id} value={ex._id}>{ex.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['sets', 'Підходи'], ['reps', 'Повтори'], ['weightKg', 'Вага (кг)'], ['durationMin', 'Тривалість (хв)']].map(([key, label]) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <input type="number" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
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
