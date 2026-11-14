import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../store/UserContext';

// Sessiya UserContext'dagi yagona auth tinglovchisidan olinadi.
export const ProtectedRoute = () => {
  const { session, sessionLoading } = useUser();

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E1117]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4ADE80", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // Agar sessiya bo'lmasa, login sahifasiga yuboramiz
  return session ? <Outlet /> : <Navigate to="/login" replace />;
};
