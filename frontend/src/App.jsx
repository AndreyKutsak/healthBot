import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Exercises from './pages/Exercises';
import ExerciseHistory from './pages/ExerciseHistory';
import Food from './pages/Food';
import FoodHistory from './pages/FoodHistory';
import Layout from './components/Layout';

function RequireAuth({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="exercises" element={<Exercises />} />
          <Route path="exercise-history" element={<ExerciseHistory />} />
          <Route path="food" element={<Food />} />
          <Route path="food-history" element={<FoodHistory />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
