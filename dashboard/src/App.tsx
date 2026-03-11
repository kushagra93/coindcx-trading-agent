import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { PositionsPage } from './pages/PositionsPage';
import { StrategiesPage } from './pages/StrategiesPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { WalletPage } from './pages/WalletPage';
import { RiskPage } from './pages/RiskPage';
import { AIChatPage } from './pages/AIChatPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminPage } from './pages/AdminPage';
import { SupervisorPage } from './pages/SupervisorPage';
import { LoginPage } from './pages/LoginPage';
import { getAuthToken } from './api/client';
import { AppRoutes } from './app/AppRoutes';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/*" element={<AppRoutes />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/positions" element={<PositionsPage />} />
          <Route path="/strategies" element={<StrategiesPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/ai-chat" element={<AIChatPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/supervisor" element={<SupervisorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
