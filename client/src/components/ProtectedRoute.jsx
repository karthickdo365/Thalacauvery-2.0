import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children }) => {
  const { token, user } = useSelector((state) => state.auth);
  const location = useLocation();

  // Not logged in
  if (!token) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Check admin
  const username =
    user?.username ||
    localStorage.getItem('username');

  const role =
    user?.role ||
    localStorage.getItem('role');

  const isAdmin =
    username === 'admin' ||
    role === 'admin';

  // Machine users cannot access admin pages
  if (!isAdmin) {
    const machineType = localStorage.getItem('machineType');

    if (machineType === 'big') {
      return (
        <Navigate
          to="/big-machine"
          replace
        />
      );
    }

    if (machineType === 'small') {
      return (
        <Navigate
          to="/small-machine"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;
