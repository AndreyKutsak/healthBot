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
  const [detailUser, setDetailUser] = useState(null);
  const [messageTarget, setMessageTarget] = useState(null);

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
                  <th>Спортзал</th>
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
                    <td>{u.canUseGym ? 'Так' : 'Ні'}</td>
                    <td>{u.height} см</td>
                    <td>{u.weight} кг</td>
                    <td>{GOAL_LABEL[u.goal] || '—'}</td>
                    <td>
                      <span className={`badge ${u.isBlocked ? 'blocked' : 'active'}`}>
                        {u.isBlocked ? 'Заблок.' : 'Активний'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setDetailUser({ ...u })}>
                        👁️
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditUser({ ...u })}>
                        ✏️
                      </button>
                      <button className="btn btn-outline btn-sm" title="Написати повідомлення" onClick={() => setMessageTarget({ ...u })}>
                        💬
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

      {/* Detail Modal */}
      {detailUser && (
        <UserDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onEdit={(u) => { setDetailUser(null); setEditUser({ ...u }); }}
        />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); fetchUsers(); }}
        />
      )}

      {/* Send Message Modal */}
      {messageTarget && (
        <SendMessageModal
          user={messageTarget}
          onClose={() => setMessageTarget(null)}
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

function UserDetailModal({ user, onClose, onEdit }) {
  const [violations, setViolations] = useState(null);
  const [loadingV, setLoadingV] = useState(true);
  const [calorieStats, setCalorieStats] = useState(null);
  const [loadingC, setLoadingC] = useState(true);
  const [trainingPlan, setTrainingPlan] = useState(undefined);

  useEffect(() => {
    setLoadingV(true);
    api.get(`/users/${user._id}/violations`)
      .then(({ data }) => setViolations(data))
      .catch(() => setViolations(null))
      .finally(() => setLoadingV(false));

    setLoadingC(true);
    api.get(`/users/${user._id}/calorie-stats`)
      .then(({ data }) => setCalorieStats(data))
      .catch(() => setCalorieStats(null))
      .finally(() => setLoadingC(false));

    api.get(`/users/${user._id}/training-plan`)
      .then(({ data }) => setTrainingPlan(data.plan))
      .catch(() => setTrainingPlan(null));
  }, [user._id]);

  const DIET_LABEL = {
    standard: 'Звичайне', vegetarian: 'Вегетаріанське', vegan: 'Веганське',
    low_carb: 'Низьковуглеводне', keto: 'Кето',
  };
  const EXP_LABEL = {
    beginner: 'Початківець', intermediate: 'Середній рівень', advanced: 'Просунутий',
  };

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || String(user.telegramId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560, width: '95%', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ marginBottom: 2 }}>👤 {displayName}</h2>
            {user.username && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                @{user.username} · ID: {user.telegramId}
              </div>
            )}
          </div>
          <span className={`badge ${user.isBlocked ? 'blocked' : 'active'}`}>
            {user.isBlocked ? 'Заблокований' : 'Активний'}
          </span>
        </div>

        <DetailSection title="Особисті дані">
          <DetailRow label="Вік" value={`${user.age} р.`} />
          <DetailRow label="Стать" value={GENDER_LABEL[user.gender]} />
          <DetailRow label="Зріст" value={`${user.height} см`} />
          <DetailRow label="Вага" value={`${user.weight} кг`} />
          <DetailRow label="Ціль" value={GOAL_LABEL[user.goal]} />
        </DetailSection>

        <DetailSection title="📊 КБЖВ (денна норма)">
          {user.dailyCalories ? (
            <>
              <DetailRow label="Калорії" value={`${user.dailyCalories} ккал`} />
              <DetailRow label="Білки" value={`${user.dailyProtein} г`} />
              <DetailRow label="Жири" value={`${user.dailyFat} г`} />
              <DetailRow label="Вуглеводи" value={`${user.dailyCarbs} г`} />
            </>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Не розраховано</span>}
        </DetailSection>

        <DetailSection title="🔥 Калорії та активність">
          {loadingC ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Завантаження...</span>
          ) : calorieStats ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Сьогодні
                </div>
                {calorieStats.norm.calories ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Спожито / норма</span>
                      <span style={{ fontWeight: 600 }}>
                        {calorieStats.consumed.today} / {calorieStats.norm.calories} ккал
                      </span>
                    </div>
                    <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.round(calorieStats.consumed.today / calorieStats.norm.calories * 100))}%`,
                        height: '100%',
                        background: calorieStats.consumed.today > calorieStats.norm.calories ? '#ef4444' : 'var(--primary)',
                      }} />
                    </div>
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {[
                    { label: 'Спожито', value: calorieStats.consumed.today, color: 'var(--primary)' },
                    { label: 'Спалено', value: calorieStats.burned.today, color: '#22c55e' },
                    { label: 'Нетто', value: calorieStats.consumed.today - calorieStats.burned.today, color: 'var(--text)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', background: 'var(--bg)', borderRadius: 6 }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color }}>{value}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label} ккал</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'За тиждень', c: calorieStats.consumed.week, b: calorieStats.burned.week },
                  { label: 'За місяць', c: calorieStats.consumed.month, b: calorieStats.burned.month },
                ].map(({ label, c, b }) => (
                  <div key={label} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '0.82rem', marginBottom: 2 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Спожито: </span>
                      <strong>{c.toLocaleString()}</strong> ккал
                    </div>
                    <div style={{ fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Спалено: </span>
                      <strong style={{ color: '#22c55e' }}>{b.toLocaleString()}</strong> ккал
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Немає даних</span>
          )}
        </DetailSection>

        {(user.dietType || user.mealCount || user.foodRestrictions) && (
          <DetailSection title="🥗 Профіль харчування">
            {user.dietType && <DetailRow label="Тип" value={DIET_LABEL[user.dietType] || user.dietType} />}
            {user.mealCount && <DetailRow label="Прийомів їжі" value={`${user.mealCount}/день`} />}
            {user.foodRestrictions && <DetailRow label="Обмеження" value={user.foodRestrictions} />}
          </DetailSection>
        )}

        <DetailSection title="💪 Тренування">
          <DetailRow label="Спортзал" value={user.canUseGym ? 'Так' : 'Ні'} />
          {user.canUseGym && (
            <>
              {user.trainingDays?.length > 0 && <DetailRow label="Дні" value={user.trainingDays.join(', ')} />}
              {user.gymFocus && <DetailRow label="Упор" value={user.gymFocus} />}
              {user.gymExperience && <DetailRow label="Досвід" value={EXP_LABEL[user.gymExperience] || user.gymExperience} />}
              {user.injuries && <DetailRow label="Травми" value={user.injuries} />}
            </>
          )}
        </DetailSection>

        <DetailSection title="📋 Програма тренувань">
          {trainingPlan === undefined ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Завантаження...</span>
          ) : trainingPlan ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{trainingPlan.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {trainingPlan.weeksTotal} тиж. · з {new Date(trainingPlan.createdAt).toLocaleDateString('uk-UA')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trainingPlan.schedule.map((day, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        padding: '1px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                        background: 'var(--primary)', color: '#fff',
                      }}>{day.dayOfWeek}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{day.name}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {day.exercises.map((ex, j) => (
                        <div key={j} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                          <span>•</span>
                          <span>
                            <strong style={{ color: 'var(--text)' }}>{ex.exerciseName}</strong>
                            {ex.sets ? ` — ${ex.sets}×${ex.reps || '?'}` : ''}
                            {ex.durationMin ? ` — ${ex.durationMin}хв` : ''}
                            {ex.restSec && ex.sets ? ` (відп. ${ex.restSec}с)` : ''}
                            {ex.notes ? ` · ${ex.notes}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Програму тренувань не складено</span>
          )}
        </DetailSection>

        <DetailSection title="⚠️ Зауваження">
          {loadingV ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Завантаження...</span>
          ) : violations ? (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ textAlign: 'center', padding: '8px 20px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{violations.lastWeek}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>за 7 днів</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 20px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{violations.total}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>всього</div>
                </div>
              </div>
              {violations.violations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {violations.violations.map((v, i) => (
                    <div key={i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: v.type === 'missed_workout' ? '#b45309' : '#b91c1c' }}>
                          {v.type === 'missed_workout' ? 'Пропущено тренування' : 'Порушення харчування'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {new Date(v.date).toLocaleDateString('uk-UA')}
                        </span>
                      </div>
                      {v.description && <div style={{ color: 'var(--text-muted)' }}>{v.description}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Зауважень немає</span>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Не вдалось завантажити</span>
          )}
        </DetailSection>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Закрити</button>
          <button className="btn btn-primary" onClick={() => onEdit(user)}>Редагувати</button>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-muted)',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}

function SendMessageModal({ user, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || String(user.telegramId);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError('');
    setSuccess(false);
    try {
      await api.post(`/users/${user._id}/send-message`, { message: text });
      setSuccess(true);
      setText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка надсилання');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 460 }}>
        <h2>Написати повідомлення</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
          Отримувач: <strong>{displayName}</strong>
          {user.username && <span> (@{user.username})</span>}
        </p>

        {error && <div className="error-msg">{error}</div>}
        {success && (
          <div style={{ padding: '8px 12px', background: '#dcfce7', borderRadius: 6, color: '#166534', fontSize: '0.875rem', marginBottom: 12 }}>
            Повідомлення успішно надіслано
          </div>
        )}

        <div className="form-group">
          <label>Текст повідомлення</label>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => { setText(e.target.value); setSuccess(false); }}
            placeholder="Введіть текст повідомлення..."
            style={{ resize: 'vertical', width: '100%' }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Закрити</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !text.trim()}>
            {sending ? 'Надсилання...' : 'Надіслати'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    age: user.age,
    gender: user.gender,
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
