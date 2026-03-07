import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shuffle, AlertCircle, CheckCircle, Moon, Eye, Trash2, Loader2, AlertTriangle, ChevronDown, Plus, X, Calendar } from "lucide-react";

const isLateTime = (t) => {
  if (!t) return false;
  const [h] = t.split(":").map(Number);
  return h >= 22;
};

export default function ScheduleBuilder() {
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [selectedDivIds, setSelectedDivIds] = useState([]);
  const [season, setSeason] = useState("2025-2026");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState([]);
  const [existingGames, setExistingGames] = useState([]);
  const [stats, setStats] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [divDropOpen, setDivDropOpen] = useState(false);

  const [timeframeMode, setTimeframeMode] = useState("full"); // "full" | "custom"
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [leagueBlackoutList, setLeagueBlackoutList] = useState([]);
  const [newBlackout, setNewBlackout] = useState({ date_from: "", date_to: "", reason: "" });
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);

  const [constraints, setConstraints] = useState({
    noBackToBack: true,
    noSameDay: true,
    maxDaysBetweenGames: 10,
    respectLeagueBlackouts: true,
    respectTeamBlackouts: true,
  });

  useEffect(() => {
    const load = async () => {
      const [d, t, s, b, g] = await Promise.all([
        base44.entities.Division.list(),
        base44.entities.Team.list(),
        base44.entities.IceSlot.filter({ is_available: true }),
        base44.entities.BlackoutDate.filter({ status: "approved" }),
        base44.entities.Game.list("date", 2000),
      ]);
      setDivisions(d);
      setTeams(t);
      setSlots(s);
      setBlackouts(b);
      setExistingGames(g);
      setLeagueBlackoutList(b.filter(x => !x.team_id || x.team_id === "league"));
    };
    load();
  }, []);

  const addLeagueBlackout = async () => {
    if (!newBlackout.date_from) return;
    const created = await base44.entities.BlackoutDate.create({
      team_id: "league", team_name: "League",
      date_from: newBlackout.date_from,
      date_to: newBlackout.date_to || newBlackout.date_from,
      reason: newBlackout.reason || "League blackout",
      status: "approved",
    });
    setLeagueBlackoutList(prev => [...prev, created]);
    setNewBlackout({ date_from: "", date_to: "", reason: "" });
    setShowBlackoutForm(false);
  };

  const removeLeagueBlackout = async (id) => {
    await base44.entities.BlackoutDate.delete(id);
    setLeagueBlackoutList(prev => prev.filter(b => b.id !== id));
  };

  const toggleDiv = (id) => setSelectedDivIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const selectAllDivs = () => setSelectedDivIds(
    selectedDivIds.length === divisions.length ? [] : divisions.map(d => d.id)
  );

  const getDateRange = () => {
    if (timeframeMode === "custom") return { start: customStart || null, end: customEnd || null };
    return { start: null, end: null };
  };

  const generateSchedule = () => {
    if (selectedDivIds.length === 0) { setResult({ error: "Select at least one division." }); return; }
    setGenerating(true);
    setResult(null);
    setPreview([]);
    setWarnings([]);
    setTimeout(() => {
      try {
        let allGames = [], allWarns = [];
        const { start: rangeStart, end: rangeEnd } = getDateRange();
        let poolSlots = slots.filter(s => !s.season || s.season === season);
        if (rangeStart) poolSlots = poolSlots.filter(s => s.date >= rangeStart);
        if (rangeEnd) poolSlots = poolSlots.filter(s => s.date <= rangeEnd);
        if (poolSlots.length === 0) throw new Error("No available ice slots found. Add ice slots first.");
        poolSlots = [...poolSlots].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
        const globalUsedSlots = new Set();
        for (const divId of selectedDivIds) {
          const division = divisions.find(d => d.id === divId);
          const divTeams = teams.filter(t => t.division_id === divId);
          if (divTeams.length < 2) {
            allWarns.push(`${division?.name || divId}: Skipped — needs at least 2 teams.`);
            continue;
          }
          const { games, warns } = buildScheduleForDiv(divId, division, divTeams, poolSlots, globalUsedSlots);
          allGames = allGames.concat(games);
          allWarns = allWarns.concat(warns);
        }
        setPreview(allGames);
        setWarnings(allWarns);
        const lateGames = allGames.filter(g => g.is_late_game);
        setStats({ total: allGames.length, lateGames: lateGames.length, divCount: selectedDivIds.length });
        setResult({ success: true, count: allGames.length });
      } catch (e) {
        setResult({ error: e.message });
      }
      setGenerating(false);
    }, 100);
  };

  const daysBetween = (d1, d2) => Math.abs(new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24);

  const buildScheduleForDiv = (divId, division, divTeams, poolSlots, globalUsedSlots) => {
    const warns = [];
    const targetGames = division?.games_per_team || 30;
    const leagueBlackoutDates = new Set();
    const allBlackouts = [...blackouts, ...leagueBlackoutList];
    allBlackouts.forEach(b => {
      if (!b.team_id || b.team_id === "league") {
        if (constraints.respectLeagueBlackouts) {
          let d = new Date(b.date_from + "T12:00:00");
          const end = new Date((b.date_to || b.date_from) + "T12:00:00");
          while (d <= end) { leagueBlackoutDates.add(d.toISOString().split("T")[0]); d.setDate(d.getDate() + 1); }
        }
      }
    });
    const teamBlackouts = {};
    allBlackouts.forEach(b => {
      if (b.team_id && b.team_id !== "league") {
        if (!teamBlackouts[b.team_id]) teamBlackouts[b.team_id] = [];
        teamBlackouts[b.team_id].push(b);
      }
    });
    const isTeamBlackedOut = (tid, date) => {
      if (!constraints.respectTeamBlackouts) return false;
      return (teamBlackouts[tid] || []).some(b => date >= b.date_from && date <= (b.date_to || b.date_from));
    };
    const matchups = [];
    for (let i = 0; i < divTeams.length; i++)
      for (let j = i + 1; j < divTeams.length; j++)
        matchups.push([divTeams[i], divTeams[j]]);
    const gamesPerRR = matchups.length;
    const roundRobins = Math.max(1, Math.ceil((targetGames * divTeams.length / 2) / Math.max(gamesPerRR, 1)));
    let allMatchups = [];
    for (let r = 0; r < roundRobins; r++)
      allMatchups = allMatchups.concat([...matchups].sort(() => Math.random() - 0.5));
    allMatchups = allMatchups.slice(0, Math.ceil(targetGames * divTeams.length / 2));
    const teamGameDates = {}, teamLateCounts = {}, teamGameCount = {};
    divTeams.forEach(t => { teamGameDates[t.id] = []; teamLateCounts[t.id] = 0; teamGameCount[t.id] = 0; });
    const totalLateSlots = poolSlots.filter(s => isLateTime(s.start_time) && !globalUsedSlots.has(s.id)).length;
    const totalSlots = poolSlots.filter(s => !globalUsedSlots.has(s.id)).length;
    const lateRatio = totalSlots > 0 ? totalLateSlots / totalSlots : 0;
    const targetLatePerTeam = Math.round(lateRatio * targetGames);
    const scheduledGames = [];
    let unscheduled = 0;
    for (const [home, away] of allMatchups) {
      let assigned = false;
      const homeAtLateLimit = teamLateCounts[home.id] >= targetLatePerTeam;
      const awayAtLateLimit = teamLateCounts[away.id] >= targetLatePerTeam;
      const preferNonLate = homeAtLateLimit && awayAtLateLimit;
      const sortedPool = preferNonLate
        ? [...poolSlots.filter(s => !isLateTime(s.start_time) && !globalUsedSlots.has(s.id)),
           ...poolSlots.filter(s => isLateTime(s.start_time) && !globalUsedSlots.has(s.id))]
        : poolSlots.filter(s => !globalUsedSlots.has(s.id));
      for (const slot of sortedPool) {
        if (globalUsedSlots.has(slot.id)) continue;
        if (leagueBlackoutDates.has(slot.date)) continue;
        if (isTeamBlackedOut(home.id, slot.date) || isTeamBlackedOut(away.id, slot.date)) continue;
        if (constraints.noSameDay && (teamGameDates[home.id].includes(slot.date) || teamGameDates[away.id].includes(slot.date))) continue;
        if (constraints.noBackToBack) {
          const slotDate = new Date(slot.date + "T12:00:00");
          const before = new Date(slotDate); before.setDate(slotDate.getDate() - 1);
          const after = new Date(slotDate); after.setDate(slotDate.getDate() + 1);
          const bs = before.toISOString().split("T")[0], as_ = after.toISOString().split("T")[0];
          if (teamGameDates[home.id].includes(bs) || teamGameDates[home.id].includes(as_)) continue;
          if (teamGameDates[away.id].includes(bs) || teamGameDates[away.id].includes(as_)) continue;
        }
        globalUsedSlots.add(slot.id);
        teamGameDates[home.id].push(slot.date);
        teamGameDates[away.id].push(slot.date);
        teamGameCount[home.id]++;
        teamGameCount[away.id]++;
        const late = isLateTime(slot.start_time);
        if (late) { teamLateCounts[home.id]++; teamLateCounts[away.id]++; }
        scheduledGames.push({
          season, division_id: divId, division_name: division?.name,
          home_team_id: home.id, home_team_name: home.name,
          away_team_id: away.id, away_team_name: away.name,
          arena_id: slot.arena_id, arena_name: slot.arena_name,
          date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
          is_late_game: late, game_type: "regular", status: "scheduled", ice_slot_id: slot.id,
        });
        assigned = true;
        break;
      }
      if (!assigned) unscheduled++;
    }
    if (unscheduled > 0)
      warns.push(`${division?.name}: ${unscheduled} matchup(s) could not be scheduled — not enough slots after applying constraints. Add more ice slots or relax rules.`);
    const lateCounts = Object.entries(teamLateCounts);
    const maxLate = Math.max(...lateCounts.map(([, c]) => c));
    const minLate = Math.min(...lateCounts.map(([, c]) => c));
    if (maxLate - minLate > 2) {
      const teamNames = divTeams.reduce((a, t) => { a[t.id] = t.name; return a; }, {});
      lateCounts.forEach(([id, count]) => {
        if (count > minLate + 2)
          warns.push(`${teamNames[id]}: ${count} late games vs avg — late games could not be perfectly balanced.`);
      });
    }
    if (constraints.maxDaysBetweenGames > 0) {
      divTeams.forEach(team => {
        const dates = [...teamGameDates[team.id]].sort();
        for (let i = 1; i < dates.length; i++) {
          const gap = daysBetween(dates[i - 1], dates[i]);
          if (gap > constraints.maxDaysBetweenGames)
            warns.push(`${team.name}: ${Math.round(gap)}-day gap between ${dates[i-1]} and ${dates[i]}.`);
        }
      });
    }
    const counts = Object.values(teamGameCount);
    const maxCount = Math.max(...counts), minCount = Math.min(...counts);
    if (maxCount - minCount > 2) {
      divTeams.forEach(t => {
        const c = teamGameCount[t.id];
        if (c < maxCount - 2)
          warns.push(`${t.name}: only ${c} games vs target ${targetGames} — not enough available slots.`);
      });
    }
    return { games: scheduledGames, warns };
  };

  const saveSchedule = async () => {
    if (!preview.length) return;
    setGenerating(true);
    const CHUNK = 10;
    for (let i = 0; i < preview.length; i += CHUNK) {
      await base44.entities.Game.bulkCreate(preview.slice(i, i + CHUNK));
      await new Promise(r => setTimeout(r, 2000));
    }
    const slotIds = [...new Set(preview.map(g => g.ice_slot_id).filter(Boolean))];
    for (let i = 0; i < slotIds.length; i += 5) {
      await Promise.all(slotIds.slice(i, i + 5).map(id => base44.entities.IceSlot.update(id, { is_available: false })));
      await new Promise(r => setTimeout(r, 2000));
    }
    setResult({ saved: true, count: preview.length });
    setPreview([]); setStats(null); setWarnings([]);
    setGenerating(false);
  };

  const clearDivisionSchedule = async (divId) => {
    const div = divisions.find(d => d.id === divId);
    if (!confirm(`Delete all regular season games for ${div?.name}?`)) return;
    const toDelete = existingGames.filter(g => g.division_id === divId && g.game_type === "regular");
    for (let i = 0; i < toDelete.length; i += 10) {
      await Promise.all(toDelete.slice(i, i + 10).map(g => base44.entities.Game.delete(g.id)));
      if (i + 10 < toDelete.length) await new Promise(r => setTimeout(r, 200));
    }
    const slotIds = [...new Set(toDelete.map(g => g.ice_slot_id).filter(Boolean))];
    for (let i = 0; i < slotIds.length; i += 10) {
      await Promise.all(slotIds.slice(i, i + 10).map(id => base44.entities.IceSlot.update(id, { is_available: true })));
      if (i + 10 < slotIds.length) await new Promise(r => setTimeout(r, 200));
    }
    const g = await base44.entities.Game.list("date", 2000);
    setExistingGames(g);
  };

  const inputCls = "w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule Builder</h1>
        <p className="text-gray-400 text-sm mt-1">Generate balanced schedules for one or multiple divisions</p>
      </div>

      <div className="rounded-xl border border-gray-800 p-6 space-y-6" style={{ background: "#111" }}>

        {/* Season + Divisions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Season</label>
            <input className={inputCls} value={season} onChange={e => setSeason(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Divisions *</label>
            <div className="relative">
              <button onClick={() => setDivDropOpen(!divDropOpen)}
                className="w-full flex items-center justify-between bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm">
                <span className={selectedDivIds.length === 0 ? "text-gray-500" : "text-white"}>
                  {selectedDivIds.length === 0 ? "Select divisions..." :
                   selectedDivIds.length === divisions.length ? "All divisions" :
                   `${selectedDivIds.length} division${selectedDivIds.length > 1 ? "s" : ""}`}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {divDropOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-800 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto" style={{ background: "#1a1a1a" }}>
                  <button onClick={selectAllDivs} className="w-full text-left px-3 py-2 text-xs text-yellow-400 hover:bg-white/5 border-b border-gray-800">
                    {selectedDivIds.length === divisions.length ? "Deselect All" : "Select All"}
                  </button>
                  {divisions.map(d => (
                    <button key={d.id} onClick={() => toggleDiv(d.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/5 ${selectedDivIds.includes(d.id) ? "text-yellow-400" : "text-gray-300"}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedDivIds.includes(d.id) ? "bg-yellow-500 border-yellow-500" : "border-gray-600"}`}>
                        {selectedDivIds.includes(d.id) && <CheckCircle className="w-3 h-3 text-black" />}
                      </span>
                      {d.name}
                      <span className="text-xs text-gray-500 ml-auto">{teams.filter(t => t.division_id === d.id).length} teams</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Division summaries */}
        {selectedDivIds.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {selectedDivIds.map(divId => {
              const div = divisions.find(d => d.id === divId);
              const divTeams = teams.filter(t => t.division_id === divId);
              const divExisting = existingGames.filter(g => g.division_id === divId);
              const needed = Math.ceil((divTeams.length * (div?.games_per_team || 30)) / 2);
              return (
                <div key={divId} className="rounded-lg p-3 border border-gray-800 text-xs" style={{ background: "#0d0d0d" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-white">{div?.name}</span>
                    {divExisting.length > 0 && (
                      <button onClick={() => clearDivisionSchedule(divId)} className="text-red-400 hover:text-red-300 flex items-center gap-0.5">
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5 text-gray-400">
                    <div className="flex justify-between"><span>Teams:</span><span className="text-white">{divTeams.length}</span></div>
                    <div className="flex justify-between"><span>Games/team:</span><span className="text-white">{div?.games_per_team || 30}</span></div>
                    <div className="flex justify-between"><span>Slots needed:</span><span className="text-yellow-400">{needed}</span></div>
                    {divExisting.length > 0 && <div className="flex justify-between"><span>Existing:</span><span className="text-yellow-400">{divExisting.length}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Timeframe */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Schedule Timeframe</label>
          <div className="flex gap-2 mb-3">
            {["full", "custom"].map(m => (
              <button key={m} onClick={() => setTimeframeMode(m)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={timeframeMode === m
                  ? { background: "#c0c0c0", color: "#000", borderColor: "#c0c0c0" }
                  : { background: "#0d0d0d", color: "#888", borderColor: "#333" }}>
                {m === "full" ? "Full Season" : "Custom Dates"}
              </button>
            ))}
          </div>
          {timeframeMode === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">From</label>
                <input type="date" className={inputCls} value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">To</label>
                <input type="date" className={inputCls} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-800" />

        {/* Rules + Blackouts side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scheduling Rules */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: "#d4af37" }} /> Scheduling Rules
            </h3>
            <div className="space-y-2.5">
              {[
                { key: "noSameDay", label: "No same-day games per team" },
                { key: "noBackToBack", label: "No back-to-back day games" },
                { key: "respectTeamBlackouts", label: "Respect team blackout dates" },
                { key: "respectLeagueBlackouts", label: "Respect league blackout dates" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={constraints[key]}
                    onChange={e => setConstraints(c => ({ ...c, [key]: e.target.checked }))}
                    style={{ accentColor: "#d4af37" }} className="w-4 h-4" />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
              <div className="pt-1">
                <label className="text-sm text-gray-400 block mb-1">Max days between games</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={30} className="w-20 bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                    value={constraints.maxDaysBetweenGames}
                    onChange={e => setConstraints(c => ({ ...c, maxDaysBetweenGames: parseInt(e.target.value) || 0 }))} />
                  <span className="text-sm text-gray-500">days (0 = no limit)</span>
                </div>
              </div>
            </div>
          </div>

          {/* League Blackouts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: "#d4af37" }} /> League Blackouts
              </h3>
              <button onClick={() => setShowBlackoutForm(!showBlackoutForm)}
                className="text-xs text-black px-2 py-1 rounded-lg flex items-center gap-1 font-medium"
                style={{ background: "#c0c0c0" }}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {showBlackoutForm && (
              <div className="rounded-lg p-3 mb-3 space-y-2 border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">From *</label>
                    <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                      value={newBlackout.date_from} onChange={e => setNewBlackout(b => ({ ...b, date_from: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">To</label>
                    <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                      value={newBlackout.date_to} onChange={e => setNewBlackout(b => ({ ...b, date_to: e.target.value }))} />
                  </div>
                </div>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                  placeholder="Reason" value={newBlackout.reason} onChange={e => setNewBlackout(b => ({ ...b, reason: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={() => setShowBlackoutForm(false)} className="flex-1 py-1.5 border border-gray-700 rounded-lg text-gray-400 text-xs">Cancel</button>
                  <button onClick={addLeagueBlackout} disabled={!newBlackout.date_from}
                    className="flex-1 py-1.5 text-black text-xs rounded-lg font-medium disabled:opacity-50" style={{ background: "#c0c0c0" }}>Add</button>
                </div>
              </div>
            )}
            {leagueBlackoutList.length === 0 ? (
              <p className="text-xs text-gray-600">No league blackouts set.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {leagueBlackoutList.map(b => (
                  <div key={b.id} className="flex items-start justify-between rounded-lg px-3 py-2 text-xs border border-gray-800" style={{ background: "#0d0d0d" }}>
                    <div>
                      <div className="text-white">{b.date_from}{b.date_to && b.date_to !== b.date_from ? ` → ${b.date_to}` : ""}</div>
                      {b.reason && <div className="text-gray-500 mt-0.5">{b.reason}</div>}
                    </div>
                    <button onClick={() => removeLeagueBlackout(b.id)} className="text-gray-600 hover:text-red-400 ml-2"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800" />

        {/* Results / Warnings */}
        {result?.error && (
          <div className="rounded-xl p-4 flex items-start gap-3 border border-red-500/20 bg-red-500/8">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div><p className="text-red-400 font-medium">Error</p><p className="text-red-300 text-sm mt-1">{result.error}</p></div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl p-4 border border-yellow-500/20" style={{ background: "rgba(212,175,55,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-medium text-sm">{warnings.length} Warning{warnings.length > 1 ? "s" : ""}</span>
            </div>
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {warnings.map((w, i) => <li key={i} className="text-yellow-300 text-xs flex gap-2"><span className="shrink-0 text-yellow-500">•</span><span>{w}</span></li>)}
            </ul>
          </div>
        )}

        {result?.success && stats && (
          <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">{result.count} games generated — review then save</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Games</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1"><Moon className="w-4 h-4" />{stats.lateGames}</div>
                <div className="text-xs text-gray-400">Late (10pm+)</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold" style={{ color: "#c0c0c0" }}>{stats.divCount}</div>
                <div className="text-xs text-gray-400">Divisions</div>
              </div>
            </div>
          </div>
        )}

        {result?.saved && (
          <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400">{result.count} games saved successfully!</span>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#0d0d0d" }}>
            <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">Preview — First 40 of {preview.length} games</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800" style={{ background: "#111" }}>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Division</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Date</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Time</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Matchup</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Arena</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {preview.slice(0, 40).map((g, i) => (
                    <tr key={i} className="hover:bg-white/2">
                      <td className="px-4 py-2 text-xs text-yellow-400">{g.division_name}</td>
                      <td className="px-4 py-2 text-sm text-white whitespace-nowrap">{g.date}</td>
                      <td className="px-4 py-2 text-sm text-gray-400 whitespace-nowrap">
                        <span className="flex items-center gap-1">{g.start_time} {g.is_late_game && <Moon className="w-3 h-3 text-yellow-400" />}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-300">{g.home_team_name} vs {g.away_team_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-400">{g.arena_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generate / Save buttons at bottom */}
        <div className="flex gap-3 pt-2">
          <button onClick={() => { setDivDropOpen(false); generateSchedule(); }}
            disabled={generating || selectedDivIds.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-black"
            style={{ background: "#c0c0c0" }}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
            {generating ? "Generating..." : `Generate Schedule${selectedDivIds.length > 1 ? ` (${selectedDivIds.length} divs)` : ""}`}
          </button>
          {result?.success && preview.length > 0 && (
            <button onClick={saveSchedule} disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm disabled:opacity-50 text-black transition-colors"
              style={{ background: "#d4af37" }}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save {preview.length} Games
            </button>
          )}
        </div>
      </div>
    </div>
  );
}