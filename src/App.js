import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Patients from "./pages/Patients";
import Announcements from "./pages/Announcements";
import Schedule from "./pages/Schedule";
import Events from "./pages/Events";
import Stations from "./pages/Stations";
import StationInfo from "./pages/StationInfo";
import Checklists from "./pages/Checklists";
import Missions from "./pages/Missions";
import WoundReports from "./pages/WoundReports";
import Replenishment from "./pages/Replenishment";
import Emergencies from "./pages/Emergencies";
import Transport from "./pages/Transport";
import Feedback from "./pages/Feedback";
import NotFound from "./pages/NotFound";
import LiveMap from "./pages/LiveMap";
import Analytics from "./pages/Analytics";
import SystemStats from "./pages/SystemStats";
import OrderForecast from "./pages/OrderForecast";

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
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
              <Route path="/map" element={<LiveMap />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/system" element={<SystemStats />} />
              <Route path="/emergencies" element={<Emergencies />} />
              <Route path="/transport" element={<Transport />} />
              <Route path="/users" element={<Users />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/events" element={<Events />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/stations" element={<Stations />} />
              <Route path="/station-info" element={<StationInfo />} />
              <Route path="/checklists" element={<Checklists />} />
              <Route path="/missions" element={<Missions />} />
              <Route path="/wound-reports" element={<WoundReports />} />
              <Route path="/replenishment" element={<Replenishment />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/forecast" element={<OrderForecast />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;