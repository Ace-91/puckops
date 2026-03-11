import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLeague } from "@/components/useLeague";
import { Shield, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Moon, GripVertical, X, Info, Zap, Loader2 } from "lucide-react";

export default function AssignOfficials() {
  const { leagueId } = useLeague();
  const [games, setGames] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [filterDiv, setFilterDiv] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const q = leagueId ? { league_id: leagueId } : {};
    const [g, o, a, d] = await Promise.all([
      base44.entities.Game.filter(q, "date", 2000),
      base44.entities.Official.filter({ ...q, is_active: true }),
      base44.entities.OfficialAvailability.filter(q),
      base44.entities.Division.filter(q),
    ]);
    const upcoming = g
      .filter(game => game.date >= today && game.status !== "forfeited" && game.status !== "completed")
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    setGames(upcoming);
    setOfficials(o);
    setAvailability(a);
    setDivisions(d);
    const dates = [...new Set(upcoming.map(g => g.date))].slice(0, 3);
    const exp = {};
    dates.forEach(d => { exp[d] = true; });
    setExpandedDates(exp);
    setLoading(false);
  };

  useEffect(() => { if (leagueId !== undefined) load(); }, [leagueId]);

  const isAvailable = (officialId, date) => {
    const dayAvail = availability.filter(a => a.official_id === officialId && a.date === date);
    return !dayAvail.some(a => a.is_unavailable);
  };

  const gamesForOfficial = (officialId, date) =>
    games.filter(g => g.date === date && (g.referee1_id === officialId || g.referee2_id === officialId || g.timekeeper_id === officialId));

  const officialGameCount = (officialId, date) => gamesForOfficial(officialId, date).length;

  const hasScheduleGap = (officialId, date) => {
    const dayGames = gamesForOfficial(officialId, date).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (dayGames.length < 2) return false;
    for (let i = 1; i < dayGames.length; i++) {
      const prev = dayGames[i - 1];
      const curr = dayGames[i];
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

  // ── AUTO-ASSIGN ──────────────────────────────────────────────────────────────
  const autoAssign = async () => {
    setAutoAssigning(true);
    setAutoResult(null);
    const refs = officials.filter(o => o.role === "referee");
    const tks = officials.filter(o => o.role === "timekeeper");
    const unassignedGames = games.filter(g => !g.referee1_id || !g.referee2_id || !g.timekeeper_id);
    if (unassignedGames.length === 0) { setAutoResult({ msg: "All games are already assigned!", type: "success" }); setAutoAssigning(false); return; }

    // Group by date
    const byDate = {};
    unassignedGames.forEach(g => { if (!byDate[g.date]) byDate[g.date] = []; byDate[g.date].push(g); });

    const refGameCounts = {}; refs.forEach(r => { refGameCounts[r.id] = 0; });
    const tkGameCounts = {}; tks.forEach(t => { tkGameCounts[t.id] = 0; });
    const tkLastAssignedDate = {}; // for block scheduling

    let assigned = 0;
    const updates = [];

    for (const [date, dayGames] of Object.entries(byDate)) {
      const sortedDayGames = dayGames.sort((a, b) => a.start_time.localeCompare(b.start_time));
      const availableRefs = refs.filter(r => isAvailable(r.id, date));
      const availableTks = tks.filter(t => isAvailable(t.id, date));

      // TK BLOCK SCHEDULING: group consecutive games (3-5) and assign one TK per block
      const tkBlocks = [];
      let currentBlock = [];
      for (let i = 0; i < sortedDayGames.length; i++) {
        currentBlock.push(sortedDayGames[i]);
        const nextGame = sortedDayGames[i + 1];
        const isLastOrGap = !nextGame || (nextGame.end_time && sortedDayGames[i].end_time &&
          (() => {
            const prevEndMins = sortedDayGames[i].end_time.split(":").map(Number);
            const nextStartMins = nextGame.start_time.split(":").map(Number);
            return (nextStartMins[0] * 60 + nextStartMins[1]) - (prevEndMins[0] * 60 + prevEndMins[1]) > 90;
          })());
        if (currentBlock.length >= 5 || isLastOrGap) {
          tkBlocks.push(currentBlock);
          currentBlock = [];
        }
      }

      // Assign TKs to blocks
      let tkIdx = 0;
      for (const block of tkBlocks) {
        if (availableTks.length === 0) break;
        const tk = availableTks.sort((a, b) => (tkGameCounts[a.id] || 0) - (tkGameCounts[b.id] || 0))[tkIdx % availableTks.length];
        tkIdx++;
        for (const game of block) {
          if (!game.timekeeper_id) {
            updates.push({ id: game.id, timekeeper_id: tk.id, timekeeper_name: tk.full_name });
            tkGameCounts[tk.id] = (tkGameCounts[tk.id] || 0) + 1;
            assigned++;
          }
        }
      }

      // Assign referees (3-5 consecutive games per ref shift)
      let refShiftIdx = 0;
      let refGamesInShift = 0;
      let currentRef1 = null, currentRef2 = null;

      for (const game of sortedDayGames) {
        if (!game.referee1_id || !game.referee2_id) {
          if (refGamesInShift === 0 || refGamesInShift >= 5) {
            // Rotate refs
            const sortedRefs = availableRefs
              .filter(r => r.id !== currentRef1?.id && r.id !== currentRef2?.id)
              .sort((a, b) => (refGameCounts[a.id] || 0) - (refGameCounts[b.id] || 0));
            currentRef1 = sortedRefs[0] || availableRefs[0];
            currentRef2 = sortedRefs[1] || availableRefs[1];
            refGamesInShift = 0;
          }

          if (!game.referee1_id && currentRef1) {
            updates.push({ id: game.id, referee1_id: currentRef1.id, referee1_name: currentRef1.full_name });
            refGameCounts[currentRef1.id] = (refGameCounts[currentRef1.id] || 0) + 1;
            assigned++;
          }
          if (!game.referee2_id && currentRef2 && currentRef2.id !== currentRef1?.id) {
            updates.push({ id: game.id, referee2_id: currentRef2.id, referee2_name: currentRef2.full_name });
            refGameCounts[currentRef2.id] = (refGameCounts[currentRef2.id] || 0) + 1;
            assigned++;
          }
          refGamesInShift++;
        }
      }
    }

    // Merge updates by game id
    const mergedUpdates = {};
    for (const u of updates) {
      if (!mergedUpdates[u.id]) mergedUpdates[u.id] = { id: u.id };
      Object.assign(mergedUpdates[u.id], u);
    }

    // Save all updates in batches of 5 with a delay to avoid rate limits
    const allUpdates = Object.values(mergedUpdates);
    const BATCH = 5;
    for (let i = 0; i < allUpdates.length; i += BATCH) {
      const chunk = allUpdates.slice(i, i + BATCH);
      await Promise.all(chunk.map(({ id, ...data }) => base44.entities.Game.update(id, data)));
      if (i + BATCH < allUpdates.length) await new Promise(r => setTimeout(r, 1500));
    }

    await load();
    setAutoResult({ msg: `Auto-assigned ${allUpdates.length} games successfully.`, type: "success" });
    setAutoAssigning(false);
  };

  const filtered = games.filter(g =>
    (filterDiv === "all" || g.division_id === filterDiv) &&
    (!filterDate || g.date === filterDate) &&
    (!filterUnassigned || !g.referee1_id || !g.referee2_id || !g.timekeeper_id)
  );

  const byDate = {};
  filtered.forEach(g => { if (!byDate[g.date]) byDate[g.date] = []; byDate[g.date].push(g); });
  const sortedDates = Object.keys(byDate).sort();

  const refs = officials.filter(o => o.role === "referee");
  const tks = officials.filter(o => o.role === "timekeeper");
  const unassigned = games.filter(g => !g.referee1_id || !g.referee2_id || !g.timekeeper_id).length;

  const handleDragStart = (e, officialId, role) => {
    setDragging({ officialId, role });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e, gameId, targetField) => {
    e.preventDefault();
    if (!dragging) return;
    const { officialId, role } = dragging;
    const official = officials.find(o => o.id === officialId);
    if (!official) return;
    if (targetField === "timekeeper_id" && role !== "timekeeper") return;
    if ((targetField === "referee1_id" || targetField === "referee2_id") && role !== "referee") return;
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Assign Officials</h1>
          <p className="text-gray-400 text-sm mt-0.5">{games.length} upcoming games · {unassigned} need officials assigned</p>
        </div>
        <div className="flex gap-3 items-center">
          {saving && <span className="text-xs text-sky-400 animate-pulse">Saving...</span>}
          <button
            onClick={autoAssign}
            disabled={autoAssigning || loading}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {autoAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {autoAssigning ? "Assigning..." : "Auto-Assign"}
          </button>
        </div>
      </div>

      {autoResult && (
        <div className={`mb-4 rounded-xl p-3 text-sm flex items-center gap-2 ${autoResult.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}>
          <CheckCircle className="w-4 h-4 shrink-0" /> {autoResult.msg}
          <button onClick={() => setAutoResult(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Auto-assign info */}
      <div className="bg-[#1e2533] border border-gray-800 rounded-xl p-4 mb-5 text-xs text-gray-400 flex flex-wrap gap-4">
        <div><span className="text-sky-400 font-medium">Referees:</span> Assigned in shifts of 3–5 consecutive games, rotating to balance workload.</div>
        <div><span className="text-purple-400 font-medium">Timekeepers:</span> Assigned in blocks of 3–5 consecutive games per arena/time block.</div>
        <div><span className="text-yellow-400 font-medium">Manual override:</span> Drag officials from the sidebar, or remove chips to re-assign.</div>
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
          {/* Game list */}
          <div className="xl:col-span-3 space-y-4">
            {sortedDates.length === 0 && <p className="text-center py-12 text-gray-500">No games to display.</p>}
            {sortedDates.map(date => {
              const dateGames = byDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
              const expanded = expandedDates[date];
              const fullyAssigned = dateGames.filter(g => g.referee1_id && g.referee2_id && g.timekeeper_id).length;
              return (
                <div key={date} className="bg-[#1e2533] rounded-xl border border-gray-800 overflow-hidden">
                  <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
                    onClick={() => setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))}>
                    <div className="flex items-center gap-3">
                      {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <span className="font-semibold text-white">
                        {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </span>
                      <span className="text-xs text-gray-400">{dateGames.length} games</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${fullyAssigned === dateGames.length ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"}`}>
                      {fullyAssigned}/{dateGames.length} assigned
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-800 divide-y divide-gray-800/60">
                      {dateGames.map((game, idx) => {
                        const fullyAssigned = game.referee1_id && game.referee2_id && game.timekeeper_id;
                        const isTarget = dropTarget?.gameId === game.id;
                        return (
                          <div key={game.id}
                            className={`px-4 py-3 transition-colors ${isTarget ? "bg-sky-500/10" : "hover:bg-white/2"}`}
                            onDragOver={e => { e.preventDefault(); setDropTarget({ gameId: game.id }); }}
                            onDragLeave={() => setDropTarget(null)}>
                            <div className="flex items-start gap-3 flex-wrap">
                              <div className="w-14 shrink-0 text-center pt-0.5">
                                <div className="text-sm font-bold text-white">{game.start_time}</div>
                                {game.is_late_game && <Moon className="w-3 h-3 text-yellow-400 mx-auto mt-0.5" />}
                              </div>
                              <div className="flex-1 min-w-40">
                                <div className="text-sm font-semibold text-white">{game.home_team_name} <span className="text-gray-500 text-xs font-normal">vs</span> {game.away_team_name}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{game.division_name} · {game.arena_name}</div>
                              </div>
                              <div className="flex flex-wrap gap-2 items-start">
                                {[
                                  { field: "referee1_id", label: "Ref 1", nameField: "referee1_name", color: "sky", role: "referee" },
                                  { field: "referee2_id", label: "Ref 2", nameField: "referee2_name", color: "sky", role: "referee" },
                                  { field: "timekeeper_id", label: "TK", nameField: "timekeeper_name", color: "purple", role: "timekeeper" },
                                ].map(({ field, label, nameField, color, role }) => (
                                  <div key={field}
                                    className={`min-w-28 border rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${isTarget && (dragging?.role === role || !dragging) ? `border-${color}-400/50 bg-${color}-500/10` : "border-gray-700 bg-gray-900/50"}`}
                                    onDragOver={e => { e.preventDefault(); setDropTarget({ gameId: game.id, field }); }}
                                    onDrop={e => handleDrop(e, game.id, field)}
                                  >
                                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                                    {game[field]
                                      ? <OfficialChip name={game[nameField]} field={field} gameId={game.id} color={color} />
                                      : (
                                        <select
                                          className="bg-transparent text-xs text-gray-500 w-full focus:outline-none cursor-pointer"
                                          value=""
                                          onChange={e => {
                                            const o = officials.find(x => x.id === e.target.value);
                                            if (o) assignOfficial(game.id, field, o.id, o.full_name);
                                          }}
                                        >
                                          <option value="">— assign —</option>
                                          {officials.filter(o => o.role === role && isAvailable(o.id, game.date)).map(o => (
                                            <option key={o.id} value={o.id}>{o.full_name} ({officialGameCount(o.id, game.date)} games)</option>
                                          ))}
                                        </select>
                                      )}
                                  </div>
                                ))}
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1 ${fullyAssigned ? "bg-green-500/20" : "bg-orange-500/20"}`}>
                                  {fullyAssigned ? <CheckCircle className="w-3 h-3 text-green-400" /> : <AlertCircle className="w-3 h-3 text-orange-400" />}
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

          {/* Officials sidebar */}
          <div className="xl:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-sky-400" /> Referees</h3>
                <div className="space-y-2">
                  {refs.map(o => {
                    const date = filterDate || sortedDates[0];
                    const avail = date ? isAvailable(o.id, date) : true;
                    const count = games.filter(g => g.referee1_id === o.id || g.referee2_id === o.id).length;
                    const gap = date ? hasScheduleGap(o.id, date) : false;
                    return (
                      <div key={o.id} draggable onDragStart={e => handleDragStart(e, o.id, "referee")} onDragEnd={() => setDragging(null)}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${avail ? "border-gray-700 bg-gray-900/40 hover:border-sky-500/50" : "border-red-500/20 bg-red-500/5 opacity-50"}`}>
                        <GripVertical className="w-3 h-3 text-gray-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{o.full_name}</div>
                          <div className="text-xs text-gray-500">{o.certification_level}</div>
                        </div>
                        <div className="text-right shrink-0">
                          {!avail ? <span className="text-xs text-red-400">Unavail</span>
                            : <span className={`text-xs ${count >= 50 ? "text-red-400" : count >= 25 ? "text-yellow-400" : "text-green-400"}`}>{count} games</span>}
                          {gap && <div className="text-xs text-orange-400">⚠ gap</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-purple-400" /> Timekeepers</h3>
                <div className="space-y-2">
                  {tks.map(o => {
                    const date = filterDate || sortedDates[0];
                    const avail = date ? isAvailable(o.id, date) : true;
                    const count = games.filter(g => g.timekeeper_id === o.id).length;
                    return (
                      <div key={o.id} draggable onDragStart={e => handleDragStart(e, o.id, "timekeeper")} onDragEnd={() => setDragging(null)}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${avail ? "border-gray-700 bg-gray-900/40 hover:border-purple-500/50" : "border-red-500/20 bg-red-500/5 opacity-50"}`}>
                        <GripVertical className="w-3 h-3 text-gray-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{o.full_name}</div>
                        </div>
                        <span className={`text-xs ${count >= 50 ? "text-red-400" : count >= 25 ? "text-yellow-400" : "text-green-400"}`}>{count} games</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Legend</h3>
                <div className="space-y-1 text-xs">
                  <div><span className="text-green-400">● </span><span className="text-gray-400">0–24 games total</span></div>
                  <div><span className="text-yellow-400">● </span><span className="text-gray-400">25–49 games total</span></div>
                  <div><span className="text-red-400">● </span><span className="text-gray-400">50+ games total</span></div>
                  <div><span className="text-orange-400">⚠ </span><span className="text-gray-400">gap in schedule</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}