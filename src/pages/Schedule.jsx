import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, Moon, ChevronLeft, ChevronRight, Search, Download, Pencil, Check, X, Filter, Trash2, CheckSquare, Square, MapPin, Clock, Users, AlertTriangle } from "lucide-react";
import ProgressModal from "@/components/ProgressModal";
import { batchDelete, batchUpdate } from "@/components/batchOps";

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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [progress, setProgress] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const cancelRef = useRef(false);

  function getWeekStart(d) {
    const date = new Date(d);
    date.setDate(date.getDate() - date.getDay());
    return date;
  }

  const load = async () => {
    setLoading(true);
    const [g, d] = await Promise.all([
      base44.entities.Game.list("date", 5000),
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
    (!search || g.home_team_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.away_team_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.arena_name?.toLowerCase().includes(search.toLowerCase()))
  );

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

  const runDelete = async (ids, title) => {
    cancelRef.current = false;
    setProgress({ title, current: 0, total: ids.length });
    await batchDelete(
      ids,
      id => base44.entities.Game.delete(id),
      (current, total) => setProgress({ title, current, total }),
      cancelRef
    );
    setProgress(null);
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected game(s)?`)) return;
    const ids = [...selectedIds];
    await runDelete(ids, "Deleting Selected Games");
    setGames(prev => prev.filter(g => !selectedIds.has(g.id)));
    setSelectedIds(new Set());
  };

  const deleteDate = async (date) => {
    const dateGames = byDate[date] || [];
    if (!confirm(`Delete all ${dateGames.length} game(s) on ${date}?`)) return;
    const ids = dateGames.map(g => g.id);
    await runDelete(ids, `Deleting games on ${date}`);
    setGames(prev => prev.filter(g => g.date !== date));
    setSelectedIds(prev => {
      const n = new Set(prev); dateGames.forEach(g => n.delete(g.id)); return n;
    });
  };

  const deleteAllGames = async () => {
    setShowDeleteAllConfirm(false);
    cancelRef.current = false;
    // Fetch ALL games fresh — avoids using the display-capped local state
    setProgress({ title: "Loading all games...", current: 0, total: 1 });
    const allGames = await base44.entities.Game.list("date", 20000);
    const allIds = allGames.map(g => g.id);
    const slotIds = [...new Set(allGames.map(g => g.ice_slot_id).filter(Boolean))];
    const total = allIds.length + slotIds.length;
    setProgress({ title: `Clearing Schedule (${allIds.length} games)`, current: 0, total });

    await batchDelete(
      allIds,
      id => base44.entities.Game.delete(id),
      (current) => setProgress({ title: "Clearing Schedule", current, total }),
      cancelRef
    );
    await batchUpdate(
      slotIds,
      id => base44.entities.IceSlot.update(id, { is_available: true }),
      (current) => setProgress({ title: "Restoring Ice Slots", current: allIds.length + current, total }),
      cancelRef
    );
    setProgress(null);
    setGames([]);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const selectDate = (date) => {
    const ids = (byDate[date] || []).map(g => g.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (allSelected) ids.forEach(id => n.delete(id));
      else ids.forEach(id => n.add(id));
      return n;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(g => g.id)));
  };

  const exportCSV = () => {
    const headers = ["Date", "Start Time", "Division", "Home Team", "Away Team", "Arena", "Type", "Status", "Referee 1", "Referee 2", "Timekeeper", "Late Game", "Notes"];
    const rows = filtered.map(g => [
      g.date, g.start_time, g.division_name, g.home_team_name, g.away_team_name,
      g.arena_name, g.game_type, g.status, g.referee1_name || "", g.referee2_name || "",
      g.timekeeper_name || "", g.is_late_game ? "Yes" : "No", g.notes || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `schedule_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek); d.setDate(d.getDate() + i); return d;
  });
  const gamesInWeek = weekDays.map(day => {
    const dateStr = day.toISOString().split("T")[0];
    return { day, games: filtered.filter(g => g.date === dateStr) };
  });
  const unassigned = filtered.filter(g => !g.referee1_name && !g.timekeeper_name).length;

  return (
    <div>
      {progress && <ProgressModal title={progress.title} current={progress.current} total={progress.total} onCancel={() => { cancelRef.current = true; }} />}

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {filtered.length} games
            {unassigned > 0 && <span className="ml-2 text-orange-400">· {unassigned} unassigned</span>}
            {selectedIds.size > 0 && <span className="ml-2 text-yellow-400">· {selectedIds.size} selected</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {selectedIds.size > 0 && (
            <button onClick={deleteSelected}
              className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-sm">
              <Trash2 className="w-4 h-4" /> Delete {selectedIds.size}
            </button>
          )}
          {games.length > 0 && (
            <button onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-400 px-3 py-1.5 rounded-lg text-sm">
              <Trash2 className="w-4 h-4" /> Clear All ({games.length})
            </button>
          )}
          <button onClick={selectAll} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm" style={{ background: "#111" }}>
            {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4 text-yellow-400" /> : <Square className="w-4 h-4" />}
            {selectedIds.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-black" style={{ background: "#c0c0c0" }}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-sm ${showFilters ? "border-yellow-500/40 text-yellow-400" : "border-gray-700 text-gray-300"}`} style={{ background: "#111" }}>
            <Filter className="w-4 h-4" /> Filter
          </button>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "text-black font-medium" : "text-gray-400"}`} style={{ background: viewMode === "list" ? "#c0c0c0" : "#111" }}>List</button>
            <button onClick={() => setViewMode("calendar")} className={`px-3 py-1.5 text-sm ${viewMode === "calendar" ? "text-black font-medium" : "text-gray-400"}`} style={{ background: viewMode === "calendar" ? "#c0c0c0" : "#111" }}>Calendar</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="w-full border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" style={{ background: "#111" }}
            placeholder="Search teams or arena..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {showFilters && (
          <>
            <select className="border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" style={{ background: "#111" }}
              value={filterDiv} onChange={e => setFilterDiv(e.target.value)}>
              <option value="all">All Divisions</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" style={{ background: "#111" }}
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <select className="border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" style={{ background: "#111" }}
              value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="regular">Regular Season</option>
              <option value="playoff">Playoffs</option>
            </select>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="rounded-xl h-28 animate-pulse" style={{ background: "#111" }} />)}</div>
      ) : viewMode === "list" ? (
        <div className="space-y-6">
          {sortedDates.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No games found.</p>
            </div>
          )}
          {sortedDates.map(date => {
            const dateGames = byDate[date].sort((a, b) => a.start_time?.localeCompare(b.start_time));
            const allDateSelected = dateGames.every(g => selectedIds.has(g.id));
            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => selectDate(date)} className="text-gray-500 hover:text-yellow-400 shrink-0">
                    {allDateSelected ? <CheckSquare className="w-4 h-4 text-yellow-400" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="text-sm font-semibold" style={{ color: "#c0c0c0" }}>
                    {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </div>
                  <div className="flex-1 h-px bg-gray-800" />
                  <span className="text-xs text-gray-500">{dateGames.length} game{dateGames.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => deleteDate(date)} className="text-gray-600 hover:text-red-400" title="Delete all games on this date">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid gap-2">
                  {dateGames.map(game => (
                    <div key={game.id} className={`rounded-xl border transition-colors ${selectedIds.has(game.id) ? "border-yellow-500/40 bg-yellow-500/5" : editingGameId === game.id ? "border-gray-500/50" : "border-gray-800 hover:border-gray-700"}`} style={{ background: "#0d0d0d" }}>
                      {editingGameId === game.id ? (
                        <div className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Date</label>
                              <input type="date" className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                                value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Start Time</label>
                              <input type="time" className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                                value={editForm.start_time} onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Status</label>
                              <select className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                                value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="text-xs text-gray-400 block mb-1">Notes</label>
                            <input className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                              placeholder="Optional notes..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-sm">
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                            <button onClick={() => saveEdit(game.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-black text-sm font-medium disabled:opacity-50" style={{ background: "#c0c0c0" }}>
                              <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 flex items-center gap-3">
                          <button onClick={() => toggleSelect(game.id)} className="text-gray-500 hover:text-yellow-400 shrink-0">
                            {selectedIds.has(game.id) ? <CheckSquare className="w-4 h-4 text-yellow-400" /> : <Square className="w-4 h-4" />}
                          </button>
                          <div className="w-16 shrink-0 text-center">
                            <div className="text-sm font-bold text-white">{game.start_time}</div>
                            {game.is_late_game && <Moon className="w-3.5 h-3.5 text-yellow-400 mx-auto mt-0.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white">
                              {game.home_team_name} <span className="text-gray-500 font-normal text-xs">vs</span> {game.away_team_name}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{game.division_name}</span>
                              {game.arena_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{game.arena_name}</span>}
                              {game.end_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Ends {game.end_time}</span>}
                              {game.game_type === "playoff" && <span className="text-purple-400">Playoff</span>}
                            </div>
                            {(game.referee1_name || game.timekeeper_name) ? (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {game.referee1_name && <span>Ref: {game.referee1_name}{game.referee2_name ? `, ${game.referee2_name}` : ""}</span>}
                                {game.timekeeper_name && <span className="ml-2">TK: {game.timekeeper_name}</span>}
                              </div>
                            ) : (
                              <div className="text-xs text-orange-400 mt-0.5">Officials unassigned</div>
                            )}
                            {game.notes && <div className="text-xs text-gray-500 mt-0.5 italic">"{game.notes}"</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[game.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                              {game.status?.replace(/_/g, " ")}
                            </span>
                            <button onClick={() => startEdit(game)} className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/5">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={async () => {
                              if (!confirm("Delete this game?")) return;
                              await base44.entities.Game.delete(game.id);
                              setGames(prev => prev.filter(g => g.id !== game.id));
                            }} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }}
              className="p-2 rounded-lg text-black hover:bg-white transition-colors" style={{ background: "#c0c0c0" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white font-medium text-sm">
              {currentWeek.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – {weekDays[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }}
              className="p-2 rounded-lg text-black hover:bg-white transition-colors" style={{ background: "#c0c0c0" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {gamesInWeek.map(({ day, games: dayGames }) => {
              const isToday = day.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];
              return (
                <div key={day.toISOString()} className={`rounded-lg border min-h-36 ${isToday ? "border-yellow-500/50" : "border-gray-800"}`} style={{ background: "#0d0d0d" }}>
                  <div className={`border-b border-gray-800 px-2 py-1.5 text-xs font-medium ${isToday ? "text-yellow-400" : "text-gray-400"}`}>
                    <div>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className={`text-base font-bold ${isToday ? "text-yellow-400" : "text-white"}`}>{day.getDate()}</div>
                  </div>
                  <div className="p-1 space-y-1">
                    {dayGames.sort((a, b) => a.start_time?.localeCompare(b.start_time)).map(g => (
                      <div key={g.id} onClick={() => startEdit(g)} className={`text-xs rounded p-1.5 cursor-pointer hover:opacity-80 ${g.is_late_game ? "bg-yellow-500/15 text-yellow-300" : "text-gray-200"}`} style={{ background: g.is_late_game ? undefined : "rgba(192,192,192,0.08)" }}>
                        <div className="font-semibold text-xs leading-tight truncate">{g.home_team_name}</div>
                        <div className="opacity-70 truncate text-xs">vs {g.away_team_name}</div>
                        <div className="opacity-60 text-xs">{g.start_time} · {g.arena_name}</div>
                        <div className="opacity-60 text-xs" style={{ color: "#d4af37" }}>{g.division_name}</div>
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

      {/* Calendar edit modal */}
      {editingGameId && viewMode === "calendar" && (() => {
        const game = games.find(g => g.id === editingGameId);
        if (!game) return null;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="rounded-xl border p-6 w-full max-w-md" style={{ background: "#111", borderColor: "rgba(192,192,192,0.3)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">{game.home_team_name} vs {game.away_team_name}</h2>
                  <p className="text-xs text-gray-400">{game.division_name} · {game.arena_name}</p>
                </div>
                <button onClick={cancelEdit}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Date</label>
                  <input type="date" className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                    value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Start Time</label>
                  <input type="time" className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                    value={editForm.start_time} onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-400 block mb-1">Status</label>
                <select className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                  value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">Notes</label>
                <input className="w-full bg-black border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                  placeholder="Optional notes..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={cancelEdit} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
                <button onClick={() => saveEdit(game.id)} disabled={saving} className="flex-1 py-2 rounded-lg text-black text-sm font-medium disabled:opacity-50" style={{ background: "#c0c0c0" }}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border p-6 w-full max-w-md" style={{ background: "#111", borderColor: "#333" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Clear Entire Schedule?</h2>
                <p className="text-sm text-gray-400">{games.length} games will be permanently deleted</p>
              </div>
            </div>
            <div className="rounded-lg p-4 mb-5 text-sm border" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              This will delete all {games.length} scheduled games and restore all ice slots to available. This cannot be undone.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteAllConfirm(false)} className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={deleteAllGames} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-medium">
                Yes, Delete All Games
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}