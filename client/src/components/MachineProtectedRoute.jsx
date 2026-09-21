import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const MachineProtectedRoute = ({
  children,
  machineType,
}) => {
  const { token, user } = useSelector(
    (state) => state.auth
  );

  const location = useLocation();

  // ==========================================
  // NOT LOGGED IN
  // ==========================================
  if (!token) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // ==========================================
  // GET MACHINE TYPE
  // ==========================================
  const selectedMachine =
    user?.machineType ||
    user?.machine ||
    user?.machine_type ||
    localStorage.getItem('machineType');

  // ==========================================
  // BIG MACHINE
  // ==========================================
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
          to="/login"
          replace
        />
      );
    }
  }

  // ==========================================
  // SMALL MACHINE
  // ==========================================
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
          to="/login"
          replace
        />
      );
    }
  }

  return children;
};

export default MachineProtectedRoute;
