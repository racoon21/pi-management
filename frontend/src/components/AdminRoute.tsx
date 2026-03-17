import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const AdminRoute = () => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
