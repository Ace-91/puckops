import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, Moon, Filter, ChevronLeft, ChevronRight, Search, Download } from "lucide-react";

export default function Schedule() {
  const [games, setGames] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDiv, setFilterDiv] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [currentWeek, setCurrentWeek] = useState(getWeekStart(new Date()));

  function getWeekStart(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - day);
    return date;
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [g, d] = await Promise.all([
        base44.entities.Game.list("-date", 500),
        base44.entities.Division.list(),
      ]);
      setGames(g);
      setDivisions(d);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = games.filter(g =>
    (filterDiv === "all" || g.division_id === filterDiv) &&
    (filterType === "all" || g.game_type === filterType) &&
    (filterStatus === "all" || g.status === filterStatus) &&
    (!search || g.home_team_name?.toLowerCase().includes(search.toLowerCase()) || g.away_team_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const exportCSV = () => {
    const headers = ["Date", "Start Time", "Division", "Home Team", "Away Team", "Arena", "Type", "Status", "Referee 1", "Referee 2", "Timekeeper", "Late Game"];
    const rows = filtered.map(g => [
      g.date, g.start_time, g.division_name, g.home_team_name, g.away_team_name,
      g.arena_name, g.game_type, g.status, g.referee1_name || "", g.referee2_name || "",
      g.timekeeper_name || "", g.is_late_game ? "Yes" : "No"
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `schedule_export_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors = {
    scheduled: "bg-green-500/10 text-green-400",
    forfeited: "bg-red-500/10 text-red-400",
    completed: "bg-gray-500/10 text-gray-400",
    postponed: "bg-yellow-500/10 text-yellow-400",
    replacement_needed: "bg-orange-500/10 text-orange-400",
  };

  // Calendar week view
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const gamesInWeek = weekDays.map(day => {
    const dateStr = day.toISOString().split("T")[0];
    return { day, games: filtered.filter(g => g.date === dateStr) };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-gray-400 text-sm mt-1">{filtered.length} games</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === "list" ? "bg-sky-500 text-white" : "bg-[#1e2533] text-gray-400 border border-gray-700"}`}>List</button>
          <button onClick={() => setViewMode("calendar")} className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === "calendar" ? "bg-sky-500 text-white" : "bg-[#1e2533] text-gray-400 border border-gray-700"}`}>Calendar</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="bg-[#1e2533] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 w-48"
            placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterDiv} onChange={e => setFilterDiv(e.target.value)}>
          <option value="all">All Divisions</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="regular">Regular Season</option>
          <option value="playoff">Playoffs</option>
        </select>
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="forfeited">Forfeited</option>
          <option value="completed">Completed</option>
          <option value="postponed">Postponed</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-16 animate-pulse" />)}</div>
      ) : viewMode === "list" ? (
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Matchup</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Division</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Arena</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Officials</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(game => (
                <tr key={game.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">{game.date}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      {game.start_time}
                      {game.is_late_game && <Moon className="w-3 h-3 text-yellow-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{game.home_team_name} <span className="text-gray-500">vs</span> {game.away_team_name}</div>
                    {game.game_type === "playoff" && <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">Playoff</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 hidden md:table-cell">{game.division_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 hidden md:table-cell">{game.arena_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                    {game.referee1_name && <div>R: {game.referee1_name}{game.referee2_name && `, ${game.referee2_name}`}</div>}
                    {game.timekeeper_name && <div>TK: {game.timekeeper_name}</div>}
                    {!game.referee1_name && !game.timekeeper_name && <span className="text-orange-400">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[game.status] || "bg-gray-500/10 text-gray-400"}`}>
                      {game.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-gray-500">No games found.</p>}
        </div>
      ) : (
        <div>
          {/* Calendar week navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }}
              className="p-2 bg-[#1e2533] rounded-lg border border-gray-700 hover:border-sky-500 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-white font-medium">
              {currentWeek.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – {weekDays[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }}
              className="p-2 bg-[#1e2533] rounded-lg border border-gray-700 hover:border-sky-500 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {gamesInWeek.map(({ day, games: dayGames }) => (
              <div key={day.toISOString()} className="bg-[#1e2533] rounded-lg border border-gray-800 min-h-32">
                <div className="border-b border-gray-700 px-2 py-1.5 text-xs font-medium text-gray-400">
                  {day.toLocaleDateString("en-US", { weekday: "short" })} {day.getDate()}
                </div>
                <div className="p-1 space-y-1">
                  {dayGames.map(g => (
                    <div key={g.id} className={`text-xs rounded p-1 ${g.is_late_game ? "bg-yellow-500/10 text-yellow-300" : "bg-sky-500/10 text-sky-300"}`}>
                      <div className="font-medium truncate">{g.home_team_name}</div>
                      <div className="text-xs opacity-70">vs {g.away_team_name}</div>
                      <div className="opacity-60">{g.start_time}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}