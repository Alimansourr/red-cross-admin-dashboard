import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Patients from "./pages/Patients";
import NotFound from "./pages/NotFound";
import Announcements from "./pages/Announcements";
import Schedule from "./pages/Schedule";
import Events from "./pages/Events";
import Stations from "./pages/Stations";
import StationInfo from "./pages/StationInfo";
import Checklists from "./pages/Checklists";
import Missions from "./pages/Missions";
import WoundReports from "./pages/WoundReports";
import Replenishment from "./pages/Replenishment";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/events" element={<Events />} />
            <Route path="/stations" element={<Stations />} />
            <Route path="/station-info" element={<StationInfo />} />
            <Route path="/checklists" element={<Checklists />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/wound-reports" element={<WoundReports />} />
            <Route path="/replenishment" element={<Replenishment />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;