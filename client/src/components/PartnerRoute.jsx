import { Navigate } from 'react-router-dom';
import usePermissions from '../hooks/usePermissions';

// Guards pages reserved for partner/admin (accounts, activity log)
const PartnerRoute = ({ children }) => {
  const { canWrite } = usePermissions();
  if (!canWrite) return <Navigate to="/dashboard" replace />;
  return children;
};

export default PartnerRoute;
