import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Moon, GripVertical, X, Info } from "lucide-react";

export default function AssignOfficials() {
  const [games, setGames] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDiv, setFilterDiv] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const [dragging, setDragging] = useState(null); // { officialId, gameId, field }
  const [dropTarget, setDropTarget] = useState(null); // { gameId, field }
  const [showOfficialInfo, setShowOfficialInfo] = useState(null);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [g, o, a, d] = await Promise.all([
      base44.entities.Game.filter({ status: "scheduled" }),
      base44.entities.Official.filter({ is_active: true }),
      base44.entities.OfficialAvailability.list(),
      base44.entities.Division.list(),
    ]);
    const upcoming = g.filter(game => game.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    setGames(upcoming);
    setOfficials(o);
    setAvailability(a);
    setDivisions(d);
    // Expand first 3 date groups by default
    const dates = [...new Set(upcoming.map(g => g.date))].slice(0, 3);
    const exp = {};
    dates.forEach(d => { exp[d] = true; });
    setExpandedDates(exp);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAvailable = (officialId, date) => {
    const dayAvail = availability.filter(a => a.official_id === officialId && a.date === date);
    return !dayAvail.some(a => a.is_unavailable);
  };

  const gamesForOfficial = (officialId, date) =>
    games.filter(g => g.date === date && (g.referee1_id === officialId || g.referee2_id === officialId || g.timekeeper_id === officialId));

  const officialGameCount = (officialId, date) => gamesForOfficial(officialId, date).length;

  // Check for gaps in official's schedule (games they're assigned to on same day)
  const hasScheduleGap = (officialId, date) => {
    const dayGames = gamesForOfficial(officialId, date).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (dayGames.length < 2) return false;
    for (let i = 1; i < dayGames.length; i++) {
      const prev = dayGames[i - 1];
      const curr = dayGames[i];
      // Check if end_time of prev is far from start_time of curr (>2hr gap)
      if (prev.end_time && curr.start_time) {
        const prevEnd = prev.end_time.split(":").map(Number);
        const currStart = curr.start_time.split(":").map(Number);
        const gapMins = (currStart[0] * 60 + currStart[1]) - (prevEnd[0] * 60 + prevEnd[1]);
        if (gapMins > 120) return true;
      }
    }
    return false;
  };

  const assignOfficial = async (gameId, field, officialId, officialName) => {
    setSaving(true);
    const nameField = field.replace("_id", "_name");
    await base44.entities.Game.update(gameId, { [field]: officialId, [nameField]: officialName });
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, [field]: officialId, [nameField]: officialName } : g));
    setSaving(false);
  };

  const removeOfficial = async (gameId, field) => {
    setSaving(true);
    const nameField = field.replace("_id", "_name");
    await base44.entities.Game.update(gameId, { [field]: "", [nameField]: "" });
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, [field]: "", [nameField]: "" } : g));
    setSaving(false);
  };

  const filtered = games.filter(g =>
    (filterDiv === "all" || g.division_id === filterDiv) &&
    (!filterDate || g.date === filterDate) &&
    (!filterUnassigned || !g.referee1_id || !g.referee2_id || !g.timekeeper_id)
  );

  // Group by date
  const byDate = {};
  filtered.forEach(g => {
    if (!byDate[g.date]) byDate[g.date] = [];
    byDate[g.date].push(g);
  });
  const sortedDates = Object.keys(byDate).sort();

  const refs = officials.filter(o => o.role === "referee");
  const tks = officials.filter(o => o.role === "timekeeper");
  const unassigned = games.filter(g => !g.referee1_id || !g.referee2_id || !g.timekeeper_id).length;

  // Drag handlers
  const handleDragStart = (e, officialId, field) => {
    setDragging({ officialId, field });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${officialId}|${field}`);
  };

  const handleDrop = async (e, gameId, targetField) => {
    e.preventDefault();
    if (!dragging) return;
    const { officialId } = dragging;
    const official = officials.find(o => o.id === officialId);
    if (!official) return;

    // Validate role match
    const isRef = official.role === "referee";
    const isTk = official.role === "timekeeper";
    if (targetField === "timekeeper_id" && !isTk) return;
    if ((targetField === "referee1_id" || targetField === "referee2_id") && !isRef) return;

    await assignOfficial(gameId, targetField, officialId, official.full_name);
    setDragging(null);
    setDropTarget(null);
  };

  const OfficialChip = ({ name, field, gameId, color = "sky" }) => (
    <div className={`flex items-center gap-1 bg-${color}-500/15 text-${color}-300 text-xs rounded px-2 py-1 group`}>
      <span className="truncate max-w-24">{name}</span>
      <button onClick={() => removeOfficial(gameId, field)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <X className="w-3 h-3 text-red-400" />
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Assign Officials</h1>
          <p className="text-gray-400 text-sm mt-0.5">{unassigned} games missing officials · Drag officials onto games to assign</p>
        </div>
        {saving && <span className="text-xs text-sky-400 animate-pulse">Saving...</span>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterDiv} onChange={e => setFilterDiv(e.target.value)}>
          <option value="all">All Divisions</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="date" className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <label className="flex items-center gap-2 cursor-pointer bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2">
          <input type="checkbox" checked={filterUnassigned} onChange={e => setFilterUnassigned(e.target.checked)} className="accent-sky-500" />
          <span className="text-sm text-gray-300">Unassigned only</span>
        </label>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-32 animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          {/* Game Schedule — takes 3 cols */}
          <div className="xl:col-span-3 space-y-4">
            {sortedDates.length === 0 && <p className="text-center py-12 text-gray-500">No games to display.</p>}
            {sortedDates.map(date => {
              const dateGames = byDate[date];
              const expanded = expandedDates[date];
              const fullyAssigned = dateGames.filter(g => g.referee1_id && g.referee2_id && g.timekeeper_id).length;
              return (
                <div key={date} className="bg-[#1e2533] rounded-xl border border-gray-800 overflow-hidden">
                  {/* Date header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
                    onClick={() => setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))}
                  >
                    <div className="flex items-center gap-3">
                      {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <span className="font-semibold text-white">
                        {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </span>
                      <span className="text-xs text-gray-400">{dateGames.length} games</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${fullyAssigned === dateGames.length ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"}`}>
                        {fullyAssigned}/{dateGames.length} assigned
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-800 divide-y divide-gray-800/60">
                      {dateGames.map(game => {
                        const fullyAssigned = game.referee1_id && game.referee2_id && game.timekeeper_id;
                        const isTarget = dropTarget?.gameId === game.id;
                        return (
                          <div
                            key={game.id}
                            className={`px-4 py-3 transition-colors ${isTarget ? "bg-sky-500/10" : "hover:bg-white/2"}`}
                            onDragOver={e => { e.preventDefault(); setDropTarget({ gameId: game.id }); }}
                            onDragLeave={() => setDropTarget(null)}
                          >
                            <div className="flex items-start gap-4">
                              {/* Time & info */}
                              <div className="w-16 shrink-0 text-center pt-0.5">
                                <div className="text-sm font-bold text-white">{game.start_time}</div>
                                {game.is_late_game && <Moon className="w-3 h-3 text-yellow-400 mx-auto mt-0.5" />}
                              </div>

                              {/* Matchup */}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white leading-tight">{game.home_team_name} <span className="text-gray-500 font-normal text-xs">vs</span> {game.away_team_name}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{game.division_name} · {game.arena_name}</div>
                              </div>

                              {/* Officials assignment — drop zones */}
                              <div className="flex flex-wrap gap-2 items-center">
                                {/* Referee 1 */}
                                <div
                                  className={`min-w-28 border rounded-lg px-2 py-1.5 transition-colors ${isTarget && dragging?.field !== "timekeeper_id" ? "border-sky-400 bg-sky-500/10" : "border-gray-700 bg-gray-900/50"}`}
                                  onDragOver={e => { e.preventDefault(); setDropTarget({ gameId: game.id, field: "referee1_id" }); }}
                                  onDrop={e => handleDrop(e, game.id, "referee1_id")}
                                >
                                  <div className="text-xs text-gray-500 mb-1">Ref 1</div>
                                  {game.referee1_id
                                    ? <OfficialChip name={game.referee1_name} field="referee1_id" gameId={game.id} />
                                    : <span className="text-xs text-gray-600 italic">Drop here</span>}
                                </div>
                                {/* Referee 2 */}
                                <div
                                  className={`min-w-28 border rounded-lg px-2 py-1.5 transition-colors ${isTarget && dragging?.field !== "timekeeper_id" ? "border-sky-400 bg-sky-500/10" : "border-gray-700 bg-gray-900/50"}`}
                                  onDragOver={e => { e.preventDefault(); setDropTarget({ gameId: game.id, field: "referee2_id" }); }}
                                  onDrop={e => handleDrop(e, game.id, "referee2_id")}
                                >
                                  <div className="text-xs text-gray-500 mb-1">Ref 2</div>
                                  {game.referee2_id
                                    ? <OfficialChip name={game.referee2_name} field="referee2_id" gameId={game.id} />
                                    : <span className="text-xs text-gray-600 italic">Drop here</span>}
                                </div>
                                {/* Timekeeper */}
                                <div
                                  className={`min-w-28 border rounded-lg px-2 py-1.5 transition-colors ${isTarget && dragging?.field === "timekeeper_id" ? "border-purple-400 bg-purple-500/10" : "border-gray-700 bg-gray-900/50"}`}
                                  onDragOver={e => { e.preventDefault(); setDropTarget({ gameId: game.id, field: "timekeeper_id" }); }}
                                  onDrop={e => handleDrop(e, game.id, "timekeeper_id")}
                                >
                                  <div className="text-xs text-gray-500 mb-1">TK</div>
                                  {game.timekeeper_id
                                    ? <OfficialChip name={game.timekeeper_name} field="timekeeper_id" gameId={game.id} color="purple" />
                                    : <span className="text-xs text-gray-600 italic">Drop here</span>}
                                </div>

                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${fullyAssigned ? "bg-green-500/20" : "bg-orange-500/20"}`}>
                                  {fullyAssigned
                                    ? <CheckCircle className="w-3 h-3 text-green-400" />
                                    : <AlertCircle className="w-3 h-3 text-orange-400" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Officials Panel — sticky sidebar */}
          <div className="xl:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Referees */}
              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" /> Referees
                </h3>
                <div className="space-y-2">
                  {refs.map(o => {
                    const date = filterDate || sortedDates[0];
                    const avail = date ? isAvailable(o.id, date) : true;
                    const count = date ? officialGameCount(o.id, date) : 0;
                    const gap = date ? hasScheduleGap(o.id, date) : false;
                    return (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={e => handleDragStart(e, o.id, "referee_id")}
                        onDragEnd={() => setDragging(null)}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${avail ? "border-gray-700 bg-gray-900/40 hover:border-sky-500/50" : "border-red-500/20 bg-red-500/5 opacity-60"}`}
                        title={avail ? `${count} games today` : "Marked unavailable"}
                      >
                        <GripVertical className="w-3 h-3 text-gray-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{o.full_name}</div>
                          <div className="text-xs text-gray-500">{o.certification_level}</div>
                        </div>
                        <div className="text-right shrink-0">
                          {!avail ? <span className="text-xs text-red-400">Unavail</span>
                            : <span className={`text-xs ${count >= 5 ? "text-red-400" : count >= 3 ? "text-yellow-400" : "text-green-400"}`}>{count} games</span>}
                          {gap && <div className="text-xs text-orange-400">⚠ gap</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timekeepers */}
              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" /> Timekeepers
                </h3>
                <div className="space-y-2">
                  {tks.map(o => {
                    const date = filterDate || sortedDates[0];
                    const avail = date ? isAvailable(o.id, date) : true;
                    const count = date ? officialGameCount(o.id, date) : 0;
                    return (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={e => handleDragStart(e, o.id, "timekeeper_id")}
                        onDragEnd={() => setDragging(null)}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${avail ? "border-gray-700 bg-gray-900/40 hover:border-purple-500/50" : "border-red-500/20 bg-red-500/5 opacity-60"}`}
                      >
                        <GripVertical className="w-3 h-3 text-gray-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{o.full_name}</div>
                        </div>
                        <span className={`text-xs ${count >= 5 ? "text-red-400" : count >= 3 ? "text-yellow-400" : "text-green-400"}`}>{count} games</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Game Count Colors</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2"><span className="text-green-400">● Green</span><span className="text-gray-400">0–2 games (available)</span></div>
                  <div className="flex items-center gap-2"><span className="text-yellow-400">● Yellow</span><span className="text-gray-400">3–4 games (busy)</span></div>
                  <div className="flex items-center gap-2"><span className="text-red-400">● Red</span><span className="text-gray-400">5+ games (at limit)</span></div>
                  <div className="flex items-center gap-2"><span className="text-orange-400">⚠ gap</span><span className="text-gray-400">&gt;2hr gap in schedule</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}