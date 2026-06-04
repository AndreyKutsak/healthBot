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

        {stats?.sportStats?.length > 0 && (
          <div className="table-card">
            <div className="table-toolbar">
              <strong style={{ fontSize: '0.9rem' }}>Топ видів спорту</strong>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Вид спорту</th>
                  <th>Кількість</th>
                </tr>
              </thead>
              <tbody>
                {stats.sportStats.map((s, i) => (
                  <tr key={s._id}>
                    <td>{i + 1}</td>
                    <td>{s._id}</td>
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
