import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useMachine } from '../context/MachineContext';

/**
 * Protects machine-specific pages.
 *
 * Usage:
 *
 * <MachineProtectedRoute machineType="big">
 *   <BigMachine />
 * </MachineProtectedRoute>
 *
 * <MachineProtectedRoute machineType="small">
 *   <SmallMachine />
 * </MachineProtectedRoute>
 */
const MachineProtectedRoute = ({ children, machineType }) => {
  const { token, user } = useSelector((state) => state.auth);
  const { hasMachine } = useMachine();
  const location = useLocation();

  // --------------------------------------------------
  // 1. User must be logged in
  // --------------------------------------------------
  if (!token) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // --------------------------------------------------
  // 2. Check whether a machine has been selected
  // --------------------------------------------------
  if (!hasMachine) {
    return (
      <Navigate
        to="/machine-selection"
        state={{ from: location }}
        replace
      />
    );
  }

  // --------------------------------------------------
  // 3. Get selected machine
  // --------------------------------------------------
  const selectedMachine =
    user?.machineType ||
    user?.machine ||
    user?.machine_type ||
    localStorage.getItem('machineType');

  // --------------------------------------------------
  // 4. Big Machine protection
  // --------------------------------------------------
  if (machineType === 'big') {
    const isBigMachine = [
      'big',
      'BIG',
      'bigMachine',
      'BIG_MACHINE',
    ].includes(selectedMachine);

    if (!isBigMachine) {
      return (
        <Navigate
          to="/machine-selection"
          replace
        />
      );
    }
  }

  // --------------------------------------------------
  // 5. Small Machine protection
  // --------------------------------------------------
  if (machineType === 'small') {
    const isSmallMachine = [
      'small',
      'SMALL',
      'smallMachine',
      'SMALL_MACHINE',
    ].includes(selectedMachine);

    if (!isSmallMachine) {
      return (
        <Navigate
          to="/machine-selection"
          replace
        />
      );
    }
  }

  // --------------------------------------------------
  // 6. Everything is valid
  // --------------------------------------------------
  return children;
};

export default MachineProtectedRoute;
