import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/stats')
      .then(({ data }) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading">Завантаження...</div></div>;

  return (
    <div className="page">
      <div className="topbar">
        <h1>Дашборд</h1>
        <span className="topbar-user">Загальна статистика</span>
      </div>

      <div style={{ padding: '28px' }}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label">Всього користувачів</div>
            <div className="value">{stats?.total ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Чоловіків</div>
            <div className="value">{stats?.males ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Жінок</div>
            <div className="value">{stats?.females ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Заблоковано</div>
            <div className="value danger">{stats?.blocked ?? 0}</div>
          </div>
        </div>

        {stats?.goalStats?.length > 0 && (
          <div className="table-card">
            <div className="table-toolbar">
              <strong style={{ fontSize: '0.9rem' }}>Розподіл за цілями</strong>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Ціль</th>
                  <th>Кількість</th>
                </tr>
              </thead>
              <tbody>
                {stats.goalStats.map((s) => (
                  <tr key={s._id}>
                    <td>{{ weight_loss: 'Схуднення', muscle_gain: 'Набір маси', maintenance: 'Підтримка форми' }[s._id] || s._id}</td>
                    <td>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {stats?.gymStats?.length > 0 && (
          <div className="table-card" style={{ marginTop: '16px' }}>
            <div className="table-toolbar">
              <strong style={{ fontSize: '0.9rem' }}>Спортзал</strong>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Кількість</th>
                </tr>
              </thead>
              <tbody>
                {stats.gymStats.map((s) => (
                  <tr key={String(s._id)}>
                    <td>{s._id === true ? 'Ходить у зал' : s._id === false ? 'Не ходить' : 'Не вказано'}</td>
                    <td>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
