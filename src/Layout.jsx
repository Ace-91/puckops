import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Calendar, Users, Shield, Clock, AlertTriangle, Home,
  Menu, X, ChevronDown, LogOut, Settings, Layers, LayoutDashboard, TrendingUp, Lock, CheckCircle, Crown, Building2
} from "lucide-react";
import HockeyOpsLogo from "@/components/HockeyOpsLogo";

const navItems = [
  // Super admin only
  { label: "Leagues", page: "LeagueManagement", icon: Crown, roles: ["super_admin"], superOnly: true },
  // League-scoped nav
  { label: "Home", page: "Home", icon: Home, roles: ["admin", "referee_coordinator", "team_manager", "referee", "timekeeper"] },
  { label: "Dashboard", page: "Dashboard", icon: LayoutDashboard, roles: ["admin", "referee_coordinator", "team_manager", "referee", "timekeeper"] },
  { label: "Schedule", page: "Schedule", icon: Calendar, roles: ["admin", "referee_coordinator", "team_manager", "referee", "timekeeper"] },
  { label: "My Portal", page: "OfficialPortal", icon: Shield, roles: ["referee", "timekeeper"], exactRoles: true },
  { label: "Teams & Divisions", page: "TeamsAndDivisions", icon: Layers, roles: ["admin"] },
  { label: "Ice Slots & Arenas", page: "IceSlots", icon: Clock, roles: ["admin"] },
  { label: "Schedule Builder", page: "ScheduleBuilder", icon: Settings, roles: ["admin"] },
  { label: "Schedule Verify", page: "ScheduleVerification", icon: CheckCircle, roles: ["admin"] },
  { label: "Blackout Dates", page: "BlackoutDates", icon: AlertTriangle, roles: ["admin", "team_manager"] },
  { label: "Officials", page: "Officials", icon: Shield, roles: ["admin", "referee_coordinator"] },
  { label: "Official Availability", page: "OfficialAvailability", icon: Calendar, roles: ["referee", "timekeeper"], exactRoles: true },
  { label: "Assign Officials", page: "AssignOfficials", icon: Users, roles: ["admin", "referee_coordinator"] },
  { label: "Forfeits", page: "Forfeits", icon: AlertTriangle, roles: ["admin", "referee_coordinator", "team_manager"] },
  { label: "Analytics", page: "Analytics", icon: TrendingUp, roles: ["admin"] },
  { label: "League Settings", page: "LeagueSettings", icon: Building2, roles: ["admin"] },
  { label: "User Management", page: "UserManagement", icon: Users, roles: ["admin"] },
  { label: "Public Data Feed", page: "PublicData", icon: TrendingUp, roles: ["admin"] },
];

// Pages that require a specific role — anyone else sees an access-denied screen
const PAGE_ROLE_REQUIREMENTS = {
  LeagueManagement: ["super_admin"],
  TeamsAndDivisions: ["admin"],
  IceSlots: ["admin"],
  ScheduleBuilder: ["admin"],
  ScheduleVerification: ["admin"],
  AssignOfficials: ["admin", "referee_coordinator"],
  Officials: ["admin", "referee_coordinator"],
  UserManagement: ["admin"],
  Analytics: ["admin"],
  LeagueSettings: ["admin"],
  OfficialPortal: ["referee", "timekeeper"],
  OfficialAvailability: ["referee", "timekeeper"],
  BlackoutDates: ["admin", "team_manager"],
  Forfeits: ["admin", "referee_coordinator", "team_manager"],
};

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const userRole = user?.role || "team_manager";
  const isSuperAdmin = userRole === "super_admin";
  const visibleNav = navItems.filter(item => {
    if (item.superOnly) return isSuperAdmin;
    if (isSuperAdmin) return false; // super admin only sees league management
    if (item.exactRoles) return item.roles.includes(userRole);
    return item.roles.includes(userRole) || userRole === "admin";
  });

  // Role-gate the current page
  const pageRequirements = PAGE_ROLE_REQUIREMENTS[currentPageName];
  const isAccessDenied = user !== null && pageRequirements && !pageRequirements.includes(userRole) && !isSuperAdmin;

  // Silver/gold theme colours
  const SILVER = "#c0c0c0";
  const GOLD = "#d4af37";

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: "#000000" }}>
      <style>{`
        :root {
          --silver: #c0c0c0;
          --gold: #d4af37;
          --surface: #111111;
          --surface2: #1a1a1a;
        }
        body { background: #000000; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #c0c0c0; }
      `}</style>

      {/* Top nav */}
      <header style={{ background: "#0a0a0a", borderBottom: "1px solid #2a2a2a" }} className="sticky top-0 z-50">
        {/* Row 1: Logo + User */}
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 border-b" style={{ borderColor: "#1a1a1a" }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link to={createPageUrl("Home")} className="flex items-center gap-2.5">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a90e8dc98ea5930930f242/4fc17f271_ChatGPTImageMar9202611_27_17PM.png" alt="PuckOperations Logo" style={{ width: 48, height: 48, objectFit: "contain" }} />
              <div className="hidden sm:block">
                <span className="font-bold text-lg" style={{ color: SILVER }}>Puck</span>
                <span className="font-bold text-lg" style={{ color: GOLD }}>Operations</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black" style={{ background: "linear-gradient(135deg, #d4af37, #c0c0c0)" }}>
                  {user.full_name?.[0] || user.email?.[0] || "U"}
                </div>
                <span className="text-sm hidden sm:block" style={{ color: SILVER }}>{user.full_name || user.email}</span>
                <button
                  onClick={() => base44.auth.logout()}
                  className="p-1.5 text-gray-500 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => base44.auth.redirectToLogin()}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-black transition-colors"
                style={{ background: SILVER }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Navigation */}
        <div className="hidden lg:block max-w-7xl mx-auto px-4">
          <nav className="flex items-center gap-0.5 py-1">
            {visibleNav.slice(0, 8).map(item => (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={currentPageName === item.page
                  ? { color: GOLD, background: "rgba(212,175,55,0.1)" }
                  : { color: "#999" }}
                onMouseEnter={e => { if (currentPageName !== item.page) e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { if (currentPageName !== item.page) e.currentTarget.style.color = "#999"; }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            {visibleNav.length > 8 && (
              <div className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  More <ChevronDown className="w-3 h-3" />
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full mt-1 rounded-lg shadow-2xl w-52 py-1 z-50 border" style={{ background: "#111", borderColor: "#2a2a2a" }}>
                    {visibleNav.slice(8).map(item => (
                      <Link
                        key={item.page}
                        to={createPageUrl(item.page)}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-b px-4 py-3 space-y-1" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
          {visibleNav.map(item => (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={currentPageName === item.page
                ? { color: GOLD, background: "rgba(212,175,55,0.1)" }
                : { color: "#888" }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {isAccessDenied ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Lock className="w-12 h-12 text-gray-600" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-1">Access Restricted</h2>
              <p className="text-gray-400 text-sm">You don't have permission to view this page.</p>
              <p className="text-gray-600 text-xs mt-1">Required role: {pageRequirements?.join(" or ")}</p>
            </div>
          </div>
        ) : children}
      </main>

      <footer className="py-4 text-center text-xs border-t" style={{ background: "#0a0a0a", borderColor: "#1a1a1a", color: "#555" }}>
        <span style={{ color: SILVER }}>Puck</span><span style={{ color: GOLD }}>Operations</span>
        <span className="ml-2">© 2026 — League Management Platform</span>
      </footer>
    </div>
  );
}