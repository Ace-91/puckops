import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Calendar, Users, Shield, AlertTriangle, Moon, MapPin, Clock } from "lucide-react";

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="rounded-xl border border-gray-800 p-5" style={{ background: "#111" }}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-gray-500 uppercase font-medium">{label}</span>
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
    <div className="text-3xl font-bold text-white">{value}</div>
  </div>
);

export default function Analytics() {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [forfeits, setForfeits] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      if (!u || u.role !== "admin") { setLoading(false); return; }
      const [g, t, d, o, f, s] = await Promise.all([
        base44.entities.Game.list("date", 3000),
        base44.entities.Team.list(),
        base44.entities.Division.list(),
        base44.entities.Official.list(),
        base44.entities.Forfeit.list("-created_date"),
        base44.entities.IceSlot.list("date", 5000),
      ]);
      setGames(g); setTeams(t); setDivisions(d); setOfficials(o); setForfeits(f); setSlots(s);
      setLoading(false);
    };
    load();
  }, []);

  if (!loading && (!user || user.role !== "admin")) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Admin access required</p>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {[...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-xl" style={{ background: "#111" }} />)}
    </div>
  );

  // --- Derived data ---
  const scheduledGames = games.filter(g => g.status === "scheduled");
  const completedGames = games.filter(g => g.status === "completed");
  const lateGames = games.filter(g => g.is_late_game);
  const unassigned = games.filter(g => !g.referee1_id && g.status === "scheduled");
  const availableSlots = slots.filter(s => s.is_available).length;

  // Games per division
  const gamesByDiv = divisions.map(d => ({
    name: d.name,
    games: games.filter(g => g.division_id === d.id).length,
    scheduled: games.filter(g => g.division_id === d.id && g.status === "scheduled").length,
    late: games.filter(g => g.division_id === d.id && g.is_late_game).length,
  })).filter(d => d.games > 0).sort((a, b) => b.games - a.games);

  // Games per day of week
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const gamesByDay = dayLabels.map((day, i) => ({
    day,
    games: games.filter(g => g.date && new Date(g.date + "T12:00:00").getDay() === i).length,
    late: games.filter(g => g.date && new Date(g.date + "T12:00:00").getDay() === i && g.is_late_game).length,
  }));

  // Games per arena
  const arenaMap = {};
  games.forEach(g => { if (g.arena_name) arenaMap[g.arena_name] = (arenaMap[g.arena_name] || 0) + 1; });
  const gamesByArena = Object.entries(arenaMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  // Officials by role
  const referees = officials.filter(o => o.role === "referee");
  const timekeepers = officials.filter(o => o.role === "timekeeper");

  // Forfeit status breakdown
  const forfeitStatuses = ["submitted", "notified", "replacement_found", "no_replacement", "confirmed_forfeit"];
  const forfeitData = forfeitStatuses.map(s => ({
    name: s.replace(/_/g, " "),
    value: forfeits.filter(f => f.status === s).length,
  })).filter(d => d.value > 0);

  // Monthly game distribution
  const monthMap = {};
  games.forEach(g => {
    if (g.date) {
      const m = g.date.slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + 1;
    }
  });
  const gamesByMonth = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([m, count]) => ({
    month: new Date(m + "-15").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    games: count,
  }));

  // Late game % per division
  const lateByDiv = divisions.map(d => {
    const divGames = games.filter(g => g.division_id === d.id);
    return {
      name: d.name,
      pct: divGames.length ? Math.round((divGames.filter(g => g.is_late_game).length / divGames.length) * 100) : 0,
      total: divGames.length,
    };
  }).filter(d => d.total > 0).sort((a, b) => b.pct - a.pct);

  const COLORS = [GOLD, SILVER, "#60a5fa", "#f87171", "#34d399", "#a78bfa", "#fb923c", "#e879f9"];

  const tooltipStyle = { background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", color: "#fff" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">League-wide stats and insights</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Games" value={games.length} icon={Calendar} color={GOLD} />
        <StatCard label="Teams" value={teams.length} icon={Users} color={SILVER} />
        <StatCard label="Officials" value={officials.length} icon={Shield} color={SILVER} />
        <StatCard label="Forfeits" value={forfeits.length} icon={AlertTriangle} color="#ef4444" />
        <StatCard label="Scheduled" value={scheduledGames.length} icon={Calendar} color="#34d399" />
        <StatCard label="Late Games (10pm+)" value={lateGames.length} icon={Moon} color={GOLD} />
        <StatCard label="Unassigned Games" value={unassigned.length} icon={Shield} color="#fb923c" />
        <StatCard label="Available Slots" value={availableSlots} icon={Clock} color={SILVER} />
      </div>

      {/* Games per month */}
      {gamesByMonth.length > 0 && (
        <div className="rounded-xl border border-gray-800 p-5" style={{ background: "#111" }}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: GOLD }} /> Games Per Month
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gamesByMonth} barSize={28}>
              <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="games" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Games by division + Late % side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-800 p-5" style={{ background: "#111" }}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: SILVER }} /> Games by Division
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gamesByDiv} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: "#aaa", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="scheduled" name="Scheduled" fill={GOLD} radius={[0, 4, 4, 0]} stackId="a" />
              <Bar dataKey="late" name="Late" fill="#555" radius={[0, 4, 4, 0]} stackId="b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-800 p-5" style={{ background: "#111" }}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Moon className="w-4 h-4" style={{ color: GOLD }} /> Late Game % by Division
          </h2>
          <div className="space-y-2.5">
            {lateByDiv.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-300">{d.name}</span>
                  <span style={{ color: d.pct > 30 ? "#ef4444" : d.pct > 15 ? GOLD : "#34d399" }}>{d.pct}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "#222" }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${d.pct}%`, background: d.pct > 30 ? "#ef4444" : d.pct > 15 ? GOLD : "#34d399" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Games by day of week */}
      <div className="rounded-xl border border-gray-800 p-5" style={{ background: "#111" }}>
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: GOLD }} /> Games by Day of Week
        </h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={gamesByDay} barSize={32}>
            <XAxis dataKey="day" tick={{ fill: "#666", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="games" name="Total" fill={SILVER} radius={[4, 4, 0, 0]} />
            <Bar dataKey="late" name="Late (10pm+)" fill={GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Arena usage + Forfeits pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-800 p-5" style={{ background: "#111" }}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: SILVER }} /> Games by Arena
          </h2>
          <div className="space-y-2">
            {gamesByArena.map((a, i) => (
              <div key={a.name} className="flex items-center gap-3">
                <div className="text-xs text-gray-500 w-4">{i + 1}</div>
                <div className="flex-1 text-sm text-gray-300 truncate">{a.name}</div>
                <div className="h-2 rounded-full flex-1 max-w-32" style={{ background: "#222" }}>
                  <div className="h-2 rounded-full" style={{ width: `${Math.round((a.count / gamesByArena[0].count) * 100)}%`, background: COLORS[i % COLORS.length] }} />
                </div>
                <div className="text-xs text-white w-8 text-right font-medium">{a.count}</div>
              </div>
            ))}
          </div>
        </div>

        {forfeitData.length > 0 && (
          <div className="rounded-xl border border-gray-800 p-5" style={{ background: "#111" }}>
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Forfeit Breakdown
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={forfeitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {forfeitData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconSize={10} formatter={(v) => <span style={{ color: "#aaa", fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Officials summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 p-5 md:col-span-1" style={{ background: "#111" }}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: SILVER }} /> Officials Roster
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-sm text-gray-300">Referees</span>
              <span className="text-xl font-bold" style={{ color: GOLD }}>{referees.length}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-sm text-gray-300">Timekeepers</span>
              <span className="text-xl font-bold" style={{ color: SILVER }}>{timekeepers.length}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-300">Active</span>
              <span className="text-xl font-bold text-green-400">{officials.filter(o => o.is_active !== false).length}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 p-5 md:col-span-2" style={{ background: "#111" }}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: SILVER }} /> Officials by Division Preference
          </h2>
          <div className="space-y-2">
            {divisions.filter(d => officials.some(o => (o.preferred_divisions || []).includes(d.id))).map(d => {
              const count = officials.filter(o => (o.preferred_divisions || []).includes(d.id)).length;
              return (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 w-20 truncate">{d.name}</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: "#222" }}>
                    <div className="h-2 rounded-full" style={{ width: `${Math.round((count / officials.length) * 100)}%`, background: SILVER }} />
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                </div>
              );
            })}
            {!divisions.some(d => officials.some(o => (o.preferred_divisions || []).includes(d.id))) && (
              <p className="text-xs text-gray-600">No division preferences set yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}