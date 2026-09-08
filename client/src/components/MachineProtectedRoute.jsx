import { Navigate, useLocation } from 'react-router-dom';
import { useMachine } from '../context/MachineContext';

/**
 * Ensures the user has selected a machine before accessing machine-specific pages.
 * If no machine is selected → redirect to /machine-selection.
 */
const MachineProtectedRoute = ({ children }) => {
  const { hasMachine } = useMachine();
  const location = useLocation();

  if (!hasMachine) {
    return <Navigate to="/machine-selection" state={{ from: location }} replace />;
  }

  return children;
};

export default MachineProtectedRoute;
