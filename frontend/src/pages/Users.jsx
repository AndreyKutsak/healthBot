import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const GENDER_LABEL = { male: 'Чоловік', female: 'Жінка' };
const GOAL_LABEL = { weight_loss: 'Схуднення', muscle_gain: 'Набір маси', maintenance: 'Підтримка форми' };
const LIMIT = 15;

export default function Users() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (genderFilter) params.gender = genderFilter;
      if (blockedFilter !== '') params.isBlocked = blockedFilter;
      const { data } = await api.get('/users', { params });
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, genderFilter, blockedFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [search, genderFilter, blockedFilter]);

  async function toggleBlock(user) {
    await api.patch(`/users/${user._id}`, { isBlocked: !user.isBlocked });
    fetchUsers();
  }

  async function deleteUser() {
    await api.delete(`/users/${deleteTarget._id}`);
    setDeleteTarget(null);
    fetchUsers();
  }

  return (
    <div className="page" style={{ padding: 0 }}>
      <div className="topbar">
        <h1>Користувачі</h1>
        <span className="topbar-user">Всього: {total}</span>
      </div>

      <div style={{ padding: '28px' }}>
        <div className="table-card">
          <div className="table-toolbar">
            <input
              placeholder="Пошук за ім'ям / username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="">Всі статі</option>
              <option value="male">Чоловіки</option>
              <option value="female">Жінки</option>
            </select>
            <select value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)}>
              <option value="">Всі статуси</option>
              <option value="false">Активні</option>
              <option value="true">Заблоковані</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">Завантаження...</div>
          ) : users.length === 0 ? (
            <div className="empty">Користувачів не знайдено</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Telegram ID</th>
                  <th>Ім'я</th>
                  <th>Username</th>
                  <th>Вік</th>
                  <th>Стать</th>
                  <th>Спорт</th>
                  <th>Зріст</th>
                  <th>Вага</th>
                  <th>Ціль</th>
                  <th>Статус</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>{u.telegramId}</td>
                    <td>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                    <td>{u.username ? `@${u.username}` : '—'}</td>
                    <td>{u.age}</td>
                    <td>
                      <span className={`badge ${u.gender}`}>{GENDER_LABEL[u.gender]}</span>
                    </td>
                    <td>{u.sport}</td>
                    <td>{u.height} см</td>
                    <td>{u.weight} кг</td>
                    <td>{GOAL_LABEL[u.goal] || '—'}</td>
                    <td>
                      <span className={`badge ${u.isBlocked ? 'blocked' : 'active'}`}>
                        {u.isBlocked ? 'Заблок.' : 'Активний'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditUser({ ...u })}>
                        ✏️
                      </button>
                      <button
                        className={`btn btn-sm ${u.isBlocked ? 'btn-primary' : 'btn-danger'}`}
                        onClick={() => toggleBlock(u)}
                      >
                        {u.isBlocked ? '🔓' : '🔒'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(u)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pages > 1 && (
            <div className="pagination">
              <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                ←
              </button>
              <span>{page} / {pages}</span>
              <button className="btn btn-outline btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); fetchUsers(); }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Видалити користувача?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Це видалить <strong>{deleteTarget.firstName || deleteTarget.username || deleteTarget.telegramId}</strong> назавжди.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>Скасувати</button>
              <button className="btn btn-danger" onClick={deleteUser}>Видалити</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    age: user.age,
    gender: user.gender,
    sport: user.sport,
    height: user.height,
    weight: user.weight,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/users/${user._id}`, form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Редагувати користувача</h2>

        {error && <div className="error-msg">{error}</div>}

        <div className="form-group">
          <label>Вік</label>
          <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Стать</label>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="male">Чоловік</option>
            <option value="female">Жінка</option>
          </select>
        </div>
        <div className="form-group">
          <label>Вид спорту</label>
          <input type="text" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Зріст (см)</label>
          <input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Вага (кг)</label>
          <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
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
