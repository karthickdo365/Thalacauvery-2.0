import { useSelector } from 'react-redux';

const WRITE_ROLES = ['partner', 'admin'];

// Single source of truth for role checks in the UI.
// The backend enforces the same rules — this only controls what is shown.
const usePermissions = () => {
  const user = useSelector((state) => state.auth.user);
  const role = user?.role || 'viewer';
  return { user, role, canWrite: WRITE_ROLES.includes(role) };
};

export default usePermissions;
