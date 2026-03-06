import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, Moon, ChevronLeft, ChevronRight, Search, Download, Pencil, Check, X, Filter } from "lucide-react";

const STATUS_OPTIONS = ["scheduled", "completed", "forfeited", "postponed", "replacement_needed"];

const STATUS_COLORS = {
  scheduled: "bg-green-500/10 text-green-400 border-green-500/20",
  forfeited: "bg-red-500/10 text-red-400 border-red-500/20",
  completed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  postponed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  replacement_needed: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

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
  const [editingGameId, setEditingGameId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  function getWeekStart(d) {
    const date = new Date(d);
    date.setDate(date.getDate() - date.getDay());
    return date;
  }

  const load = async () => {
    setLoading(true);
    const [g, d] = await Promise.all([
      base44.entities.Game.list("date", 1000),
      base44.entities.Division.list(),
    ]);
    setGames(g);
    setDivisions(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = games.filter(g =>
    (filterDiv === "all" || g.division_id === filterDiv) &&
    (filterType === "all" || g.game_type === filterType) &&
    (filterStatus === "all" || g.status === filterStatus) &&
    (!search || g.home_team_name?.toLowerCase().includes(search.toLowerCase()) || g.away_team_name?.toLowerCase().includes(search.toLowerCase()) || g.arena_name?.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by date for list view
  const byDate = filtered.reduce((acc, g) => {
    if (!acc[g.date]) acc[g.date] = [];
    acc[g.date].push(g);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();

  const startEdit = (game) => {
    setEditingGameId(game.id);
    setEditForm({ status: game.status, notes: game.notes || "", start_time: game.start_time, date: game.date });
  };

  const cancelEdit = () => { setEditingGameId(null); setEditForm({}); };

  const saveEdit = async (gameId) => {
    setSaving(true);
    await base44.entities.Game.update(gameId, editForm);
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, ...editForm } : g));
    setEditingGameId(null);
    setEditForm({});
    setSaving(false);
  };

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
    const a = document.createElement("a"); a.href = url; a.download = `schedule_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const gamesInWeek = weekDays.map(day => {
    const dateStr = day.toISOString().split("T")[0];
    return { day, games: filtered.filter(g => g.date === dateStr) };
  });

  const unassigned = filtered.filter(g => !g.referee1_name && !g.timekeeper_name).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {filtered.length} games
            {unassigned > 0 && <span className="ml-2 text-orange-400">· {unassigned} unassigned</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={exportCSV} className="flex items-center gap-1.5 bg-[#1e2533] hover:bg-[#252d3d] border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-sm transition-colors ${showFilters ? "bg-sky-500/20 border-sky-500/40 text-sky-400" : "bg-[#1e2533] border-gray-700 text-gray-300"}`}>
            <Filter className="w-4 h-4" /> Filter
          </button>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-sky-500 text-white" : "bg-[#1e2533] text-gray-400"}`}>List</button>
            <button onClick={() => setViewMode("calendar")} className={`px-3 py-1.5 text-sm ${viewMode === "calendar" ? "bg-sky-500 text-white" : "bg-[#1e2533] text-gray-400"}`}>Calendar</button>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="w-full bg-[#1e2533] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
            placeholder="Search teams or arena..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {showFilters && (
          <>
            <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              value={filterDiv} onChange={e => setFilterDiv(e.target.value)}>
              <option value="all">All Divisions</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="regular">Regular Season</option>
              <option value="playoff">Playoffs</option>
            </select>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-28 animate-pulse" />)}</div>
      ) : viewMode === "list" ? (
        /* LIST VIEW — grouped by date */
        <div className="space-y-6">
          {sortedDates.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No games found.</p>
            </div>
          )}
          {sortedDates.map(date => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="text-sm font-semibold text-sky-400">
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-500">{byDate[date].length} game{byDate[date].length !== 1 ? "s" : ""}</span>
              </div>

              {/* Games for this date */}
              <div className="grid gap-2">
                {byDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time)).map(game => (
                  <div key={game.id} className={`bg-[#1e2533] rounded-xl border transition-colors ${editingGameId === game.id ? "border-sky-500/50" : "border-gray-800 hover:border-gray-700"}`}>
                    {editingGameId === game.id ? (
                      /* Edit Mode */
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Date</label>
                            <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                              value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Start Time</label>
                            <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                              value={editForm.start_time} onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Status</label>
                            <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                              value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="text-xs text-gray-400 block mb-1">Notes</label>
                          <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                            placeholder="Optional notes..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-sm hover:border-gray-500 transition-colors">
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                          <button onClick={() => saveEdit(game.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                            <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="p-4 flex items-center gap-4">
                        {/* Time */}
                        <div className="w-16 shrink-0 text-center">
                          <div className="text-sm font-semibold text-white">{game.start_time}</div>
                          {game.is_late_game && <Moon className="w-3.5 h-3.5 text-yellow-400 mx-auto mt-0.5" />}
                        </div>

                        {/* Matchup */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">
                            {game.home_team_name} <span className="text-gray-500 font-normal text-xs">vs</span> {game.away_team_name}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>{game.division_name}</span>
                            {game.arena_name && <span>· {game.arena_name}</span>}
                            {game.game_type === "playoff" && <span className="text-purple-400">· Playoff</span>}
                          </div>
                          {/* Officials */}
                          {(game.referee1_name || game.timekeeper_name) ? (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {game.referee1_name && <span>R: {game.referee1_name}{game.referee2_name ? `, ${game.referee2_name}` : ""}</span>}
                              {game.timekeeper_name && <span className="ml-2">TK: {game.timekeeper_name}</span>}
                            </div>
                          ) : (
                            <div className="text-xs text-orange-400 mt-0.5">Officials unassigned</div>
                          )}
                          {game.notes && <div className="text-xs text-gray-500 mt-0.5 italic">"{game.notes}"</div>}
                        </div>

                        {/* Status + Edit */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[game.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                            {game.status}
                          </span>
                          <button onClick={() => startEdit(game)} className="p-1.5 text-gray-500 hover:text-sky-400 transition-colors rounded-lg hover:bg-sky-500/10" title="Edit game">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* CALENDAR VIEW */
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }}
              className="p-2 bg-[#1e2533] rounded-lg border border-gray-700 hover:border-sky-500 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-white font-medium text-sm">
              {currentWeek.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – {weekDays[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }}
              className="p-2 bg-[#1e2533] rounded-lg border border-gray-700 hover:border-sky-500 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {gamesInWeek.map(({ day, games: dayGames }) => {
              const isToday = day.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];
              return (
                <div key={day.toISOString()} className={`bg-[#1e2533] rounded-lg border min-h-36 ${isToday ? "border-sky-500/50" : "border-gray-800"}`}>
                  <div className={`border-b border-gray-800 px-2 py-1.5 text-xs font-medium ${isToday ? "text-sky-400" : "text-gray-400"}`}>
                    <div>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className={`text-base font-bold ${isToday ? "text-sky-400" : "text-white"}`}>{day.getDate()}</div>
                  </div>
                  <div className="p-1 space-y-1">
                    {dayGames.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(g => (
                      <div key={g.id} onClick={() => startEdit(g)} className={`text-xs rounded p-1.5 cursor-pointer transition-opacity hover:opacity-80 ${g.is_late_game ? "bg-yellow-500/15 text-yellow-300" : "bg-sky-500/15 text-sky-300"}`}>
                        <div className="font-semibold text-xs leading-tight truncate">{g.home_team_name}</div>
                        <div className="opacity-70 truncate text-xs">vs {g.away_team_name}</div>
                        <div className="opacity-60 text-xs">{g.start_time}</div>
                        {!g.referee1_name && <div className="text-orange-400 text-xs opacity-80">⚠ No ref</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal for calendar clicks */}
      {editingGameId && viewMode === "calendar" && (() => {
        const game = games.find(g => g.id === editingGameId);
        if (!game) return null;
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e2533] rounded-xl border border-sky-500/40 p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">{game.home_team_name} vs {game.away_team_name}</h2>
                  <p className="text-xs text-gray-400">{game.division_name} · {game.arena_name}</p>
                </div>
                <button onClick={cancelEdit}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Date</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Start Time</label>
                  <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={editForm.start_time} onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-400 block mb-1">Status</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">Notes</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                  placeholder="Optional notes..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={cancelEdit} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
                <button onClick={() => saveEdit(game.id)} disabled={saving} className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg text-white text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}