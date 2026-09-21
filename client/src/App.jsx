import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

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
import SalaryReport from './pages/SalaryReport';
import Accounts from './pages/Accounts';

import BigMachine from './pages/BigMachine';
import SmallMachine from './pages/SmallMachine';

function App() {
  const { token } = useSelector(
    (state) => state.auth
  );

  return (
    <Routes>

      {/* =====================================================
          LOGIN
      ====================================================== */}

      <Route
        path="/login"
        element={
          token ? (
            <Navigate
              to="/machine-selection"
              replace
            />
          ) : (
            <Login />
          )
        }
      />

      {/* =====================================================
          REGISTER
      ====================================================== */}

      <Route
        path="/register"
        element={
          token ? (
            <Navigate
              to="/machine-selection"
              replace
            />
          ) : (
            <Register />
          )
        }
      />

      {/* =====================================================
          MACHINE SELECTION
      ====================================================== */}

      <Route
        path="/machine-selection"
        element={
          <ProtectedRoute>
            <MachineSelection />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          BIG MACHINE ONLY
      ====================================================== */}

      <Route
        path="/big-machine"
        element={
          <MachineProtectedRoute
            machineType="big"
          >
            <BigMachine />
          </MachineProtectedRoute>
        }
      />

      {/* =====================================================
          SMALL MACHINE ONLY
      ====================================================== */}

      <Route
        path="/small-machine"
        element={
          <MachineProtectedRoute
            machineType="small"
          >
            <SmallMachine />
          </MachineProtectedRoute>
        }
      />

      {/* =====================================================
          ADMIN FULL ACCESS
      ====================================================== */}

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >

        {/* Dashboard */}

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        {/* Personal Info */}

        <Route
          path="/personal-info"
          element={<PersonalInfo />}
        />

        {/* Materials */}

        <Route
          path="/materials"
          element={<Materials />}
        />

        {/* Borewell Points */}

        <Route
          path="/borewell-points"
          element={<BorewellPoints />}
        />

        {/* Bills */}

        <Route
          path="/bills"
          element={<Bills />}
        />

        {/* Attendance */}

        <Route
          path="/attendance"
          element={<Attendance />}
        />

        {/* Salary Report */}

        <Route
          path="/salary-report"
          element={<SalaryReport />}
        />

        {/* Reports */}

        <Route
          path="/reports"
          element={<Reports />}
        />

        {/* Activity Logs */}

        <Route
          path="/activity-logs"
          element={
            <PartnerRoute>
              <ActivityLogs />
            </PartnerRoute>
          }
        />

        {/* Accounts */}

        <Route
          path="/accounts"
          element={
            <PartnerRoute>
              <Accounts />
            </PartnerRoute>
          }
        />

      </Route>

      {/* =====================================================
          UNKNOWN ROUTE
      ====================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to={
              token
                ? '/machine-selection'
                : '/login'
            }
            replace
          />
        }
      />

    </Routes>
  );
}

export default App;
