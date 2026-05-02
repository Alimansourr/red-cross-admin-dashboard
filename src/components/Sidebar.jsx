import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Siren,
  Truck,
  Users,
  Heart,
  Megaphone,
  Calendar,
  CalendarDays,
  Building2,
  ClipboardList,
  Stethoscope,
  MessageSquare,
  Package,
  LogOut,
  Bell,
  BellOff,
  Volume2,
  MapPin,
  BarChart3, 
  Database,   
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/map", icon: MapPin, label: "Live Map" }, 
  { to: "/analytics", icon: BarChart3, label: "Analytics" },  
  { to: "/emergencies", icon: Siren, label: "Emergencies" },
  { to: "/transport", icon: Truck, label: "Transport Requests" },
  { to: "/users", icon: Users, label: "Users (EMTs)" },
  { to: "/patients", icon: Heart, label: "Patients" },
  { to: "/announcements", icon: Megaphone, label: "Announcements" },
  { to: "/events", icon: Calendar, label: "Events" },
  { to: "/schedule", icon: CalendarDays, label: "Weekly Schedule" },
  { to: "/stations", icon: Building2, label: "Stations" },
  { to: "/station-info", icon: Building2, label: "Station Info" },
  { to: "/checklists", icon: ClipboardList, label: "Checklists" },
  { to: "/missions", icon: Stethoscope, label: "Missions" },
  { to: "/wound-reports", icon: Stethoscope, label: "Wound Care Reports" },
  { to: "/feedback", icon: MessageSquare, label: "Feedback" },
  { to: "/replenishment", icon: Package, label: "Replenishment" },
  { to: "/system", icon: Database, label: "System Stats" }, 
];

export default function Sidebar() {
  const { profile, logout } = useAuth();
  const { pendingCount, permissionGranted, testNotification, requestPermission } =
    useNotifications();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-redcross-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">+</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Red Cross</h1>
            <p className="text-xs text-gray-500">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* Notification status banner */}
      <div className="px-3 pt-3">
        {permissionGranted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2 text-xs">
            <Bell size={14} className="text-green-600" />
            <span className="text-green-700 font-medium flex-1">
              Notifications on
            </span>
            <button
              onClick={testNotification}
              className="text-green-700 hover:text-green-900 font-medium"
              title="Send a test notification"
            >
              Test
            </button>
          </div>
        ) : (
          <button
            onClick={requestPermission}
            className="w-full bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2 text-xs hover:bg-amber-100"
          >
            <BellOff size={14} className="text-amber-600" />
            <span className="text-amber-700 font-medium">
              Enable notifications
            </span>
          </button>
        )}
      </div>

      {/* Pending emergencies indicator */}
      {pendingCount > 0 && (
        <div className="px-3 pt-2">
          <NavLink
            to="/emergencies"
            className="bg-red-50 border-2 border-red-300 rounded-lg p-2 flex items-center gap-2 text-xs animate-pulse hover:bg-red-100"
          >
            <Volume2 size={14} className="text-red-600" />
            <span className="text-red-700 font-bold flex-1">
              {pendingCount} pending {pendingCount === 1 ? "emergency" : "emergencies"}
            </span>
          </NavLink>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto p-3 mt-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isEmergencies = to === "/emergencies";
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors text-sm ${
                  isActive
                    ? "bg-redcross-50 text-redcross-600 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {isEmergencies && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold min-w-[20px] text-center">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-gray-200">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {profile?.fullName || "Admin"}
          </p>
          <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}