import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProtectedRoute from './components/ProtectedRoute';
import PartnerRoute from './components/PartnerRoute';
import MachineProtectedRoute from './components/MachineProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import MachineSelection from './pages/MachineSelection';
import Dashboard from './pages/Dashboard';
import PersonalInfo from './pages/PersonalInfo';
import Materials from './pages/Materials';
import BorewellPoints from './pages/BorewellPoints';
import Bills from './pages/Bills';
import Reports from './pages/Reports';
import ActivityLogs from './pages/ActivityLogs';
import Attendance from './pages/Attendance';
import Accounts from './pages/Accounts';

function App() {
  const { token } = useSelector((state) => state.auth);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={token ? <Navigate to="/machine-selection" replace /> : <Login />} />
      <Route path="/register" element={token ? <Navigate to="/machine-selection" replace /> : <Register />} />

      {/* After login – machine selection (no Layout) */}
      <Route
        path="/machine-selection"
        element={
          <ProtectedRoute>
            <MachineSelection />
          </ProtectedRoute>
        }
      />

      {/* Machine-aware protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <MachineProtectedRoute>
              <Layout />
            </MachineProtectedRoute>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/personal-info" element={<PersonalInfo />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/borewell-points" element={<BorewellPoints />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/activity-logs" element={<PartnerRoute><ActivityLogs /></PartnerRoute>} />
        <Route path="/accounts" element={<PartnerRoute><Accounts /></PartnerRoute>} />
      </Route>

      <Route path="*" element={<Navigate to={token ? '/machine-selection' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
