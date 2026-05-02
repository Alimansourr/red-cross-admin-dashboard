import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, isAdmin, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You're signed in as <b>{profile?.fullName || user.email}</b>, but
            this dashboard is only for administrators.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Your role: <b>{profile?.role || "none"}</b>
          </p>
          <button
            onClick={logout}
            className="bg-redcross-500 hover:bg-redcross-600 text-white px-6 py-2 rounded-lg"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children;
}