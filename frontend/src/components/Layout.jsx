import { Outlet, NavLink, useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();
  const username = localStorage.getItem('adminUsername') || 'Admin';

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('adminUsername');
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          Health<span>Bot</span> Admin
        </div>
        <nav>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            📊 Дашборд
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>
            👥 Користувачі
          </NavLink>
          <div className="sidebar-section-label">Тренування</div>
          <NavLink to="/exercises" className={({ isActive }) => isActive ? 'active' : ''}>
            🏋️ Вправи
          </NavLink>
          <NavLink to="/exercise-history" className={({ isActive }) => isActive ? 'active' : ''}>
            📋 Історія тренувань
          </NavLink>
          <div className="sidebar-section-label">Харчування</div>
          <NavLink to="/food" className={({ isActive }) => isActive ? 'active' : ''}>
            🥗 Їжа
          </NavLink>
          <NavLink to="/food-history" className={({ isActive }) => isActive ? 'active' : ''}>
            📋 Історія харчування
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            🚪 Вийти ({username})
          </button>
        </div>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
