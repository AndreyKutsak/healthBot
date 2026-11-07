import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const CATEGORIES = ['Кардіо', 'Силові', 'Розтяжка', 'Йога', 'Функціональні', 'Інше'];
const MUSCLE_GROUPS = ['Груди', 'Спина', 'Ноги', 'Плечі', 'Руки', 'Прес', 'Все тіло', 'Інше'];
const EFFECTIVENESS = ['Низька', 'Середня', 'Висока'];
const LIMIT = 15;

const EFFECTIVENESS_COLOR = { 'Низька': '#f59e0b', 'Середня': '#f97316', 'Висока': '#22c55e' };

const EMPTY_FORM = { name: '', category: 'Силові', muscleGroup: 'Все тіло', description: '', effectiveness: 'Середня' };

export default function Exercises() {
  const [exercises, setExercises] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', data }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (catFilter) params.category = catFilter;
      if (muscleFilter) params.muscleGroup = muscleFilter;
      const { data } = await api.get('/exercises', { params });
      setExercises(data.exercises);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, catFilter, muscleFilter]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);
  useEffect(() => { setPage(1); }, [search, catFilter, muscleFilter]);

  async function handleDelete() {
    await api.delete(`/exercises/${deleteTarget._id}`);
    setDeleteTarget(null);
    fetchExercises();
  }

  return (
    <div className="page" style={{ padding: 0 }}>
      <div className="topbar">
        <h1>Вправи</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="topbar-user">Всього: {total}</span>
          <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}>
            ↑ Імпорт
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'add', data: { ...EMPTY_FORM } })}>
            + Додати вправу
          </button>
        </div>
      </div>

      <div style={{ padding: '28px' }}>
        <div className="table-card">
          <div className="table-toolbar">
            <input placeholder="Пошук за назвою..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">Всі категорії</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}>
              <option value="">Всі групи м'язів</option>
              {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="loading">Завантаження...</div>
          ) : exercises.length === 0 ? (
            <div className="empty">Вправи не знайдено</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Категорія</th>
                  <th>Група м'язів</th>
                  <th>Ефективність</th>
                  <th>Опис</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {exercises.map((ex) => (
                  <tr key={ex._id}>
                    <td><strong>{ex.name}</strong></td>
                    <td><span className="badge active">{ex.category}</span></td>
                    <td>{ex.muscleGroup}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: EFFECTIVENESS_COLOR[ex.effectiveness] + '22',
                        color: EFFECTIVENESS_COLOR[ex.effectiveness] || 'var(--text-muted)',
                      }}>
                        {ex.effectiveness || '—'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {ex.description || '—'}
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setModal({ mode: 'edit', data: { ...ex } })}
                      >✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(ex)}>🗑️</button>
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

      {showImport && (
        <ImportModal
          type="exercises"
          onClose={() => setShowImport(false)}
          onImported={fetchExercises}
        />
      )}

      {modal && (
        <ExerciseModal
          mode={modal.mode}
          initial={modal.data}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchExercises(); }}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Видалити вправу?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Буде видалено: <strong>{deleteTarget.name}</strong>
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

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { error: 'CSV має містити рядок заголовків та хоча б один запис', data: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"(.*)"$/, '$1'));
  const data = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { error: null, data };
}

function ImportModal({ type, onClose, onImported }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const EX_HEADERS = 'name,category,muscleGroup,description,effectiveness';
  const endpoint = '/exercises/import';

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setError(''); setPreview(null);
    const text = await f.text();
    let parsed;
    if (f.name.endsWith('.json')) {
      try {
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) { setError("JSON має бути масивом об'єктів"); return; }
        parsed = { error: null, data: arr };
      } catch { setError('Невалідний JSON'); return; }
    } else {
      parsed = parseCSV(text);
    }
    if (parsed.error) { setError(parsed.error); return; }
    setPreview(parsed.data);
  }

  async function handleImport() {
    if (!preview?.length) return;
    setImporting(true); setError('');
    try {
      const { data } = await api.post(endpoint, { records: preview });
      setResult(data);
      onImported();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка імпорту');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560 }}>
        <h2>Імпорт вправ</h2>
        {result ? (
          <>
            <div style={{ padding: '16px', textAlign: 'center', background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#166534' }}>Готово!</div>
              <div style={{ color: '#166534', marginTop: 6 }}>
                Додано: <strong>{result.inserted}</strong> · Оновлено: <strong>{result.updated}</strong> · Всього: <strong>{result.total}</strong>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Закрити</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Формат CSV (перший рядок — заголовки):<br />
              <code style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{EX_HEADERS}</code>
            </div>
            <div className="form-group">
              <label>Файл (.csv або .json)</label>
              <input type="file" accept=".csv,.json" onChange={handleFile}
                     style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 6, width: '100%' }} />
            </div>
            {error && <div className="error-msg">{error}</div>}
            {preview && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Знайдено: <strong>{preview.length}</strong> записів. Перші 3:
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <table style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>{Object.keys(preview[0] || {}).map((k) => <th key={k}>{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 3).map((row, i) => (
                        <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{String(v).slice(0, 25)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={onClose}>Скасувати</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={!preview?.length || importing}>
                {importing ? 'Імпортуємо...' : `Імпортувати ${preview?.length || 0} записів`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExerciseModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...initial });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (mode === 'add') {
        await api.post('/exercises', form);
      } else {
        await api.patch(`/exercises/${form._id}`, form);
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
        <h2>{mode === 'add' ? 'Нова вправа' : 'Редагувати вправу'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label>Назва</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Категорія</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Група м'язів</label>
          <select value={form.muscleGroup} onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })}>
            {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Ефективність</label>
          <select value={form.effectiveness || 'Середня'} onChange={(e) => setForm({ ...form, effectiveness: e.target.value })}>
            {EFFECTIVENESS.map((ef) => <option key={ef}>{ef}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Опис (необов'язково)</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
