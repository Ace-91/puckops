import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shuffle, AlertCircle, CheckCircle, Moon, Eye, Trash2, Loader2, Settings, AlertTriangle, Calendar, ChevronDown } from "lucide-react";

const TIMEFRAME_OPTIONS = [
  { label: "1 Month", months: 1 },
  { label: "2 Months", months: 2 },
  { label: "3 Months", months: 3 },
  { label: "Full Season", months: 0 },
  { label: "Custom Dates", months: -1 },
];

export default function ScheduleBuilder() {
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [selectedDivIds, setSelectedDivIds] = useState([]); // multi-select
  const [season, setSeason] = useState("2025-2026");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState([]);
  const [existingGames, setExistingGames] = useState([]);
  const [stats, setStats] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [divDropOpen, setDivDropOpen] = useState(false);

  // Timeframe
  const [timeframe, setTimeframe] = useState("Full Season");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

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
        base44.entities.Game.list(),
      ]);
      setDivisions(d);
      setTeams(t);
      setSlots(s);
      setBlackouts(b);
      setExistingGames(g);
    };
    load();
  }, []);

  const toggleDiv = (id) => setSelectedDivIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const selectAllDivs = () => setSelectedDivIds(
    selectedDivIds.length === divisions.length ? [] : divisions.map(d => d.id)
  );

  // Compute date range for filtering slots
  const getDateRange = () => {
    const opt = TIMEFRAME_OPTIONS.find(o => o.label === timeframe);
    if (!opt) return { start: null, end: null };
    if (opt.months === -1) return { start: customStart || null, end: customEnd || null };
    if (opt.months === 0) return { start: null, end: null }; // full season = no filter
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + opt.months);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  };

  const generateSchedule = () => {
    if (selectedDivIds.length === 0) { setResult({ error: "Select at least one division." }); return; }
    setGenerating(true);
    setResult(null);
    setPreview([]);
    setWarnings([]);

    setTimeout(() => {
      try {
        let allGames = [];
        let allWarns = [];
        const { start: rangeStart, end: rangeEnd } = getDateRange();

        for (const divId of selectedDivIds) {
          const division = divisions.find(d => d.id === divId);
          const divTeams = teams.filter(t => t.division_id === divId);
          if (divTeams.length < 2) { allWarns.push(`${division?.name}: needs at least 2 teams, skipped.`); continue; }
          const { games, warns } = buildScheduleForDiv(divId, division, divTeams, rangeStart, rangeEnd);
          allGames = allGames.concat(games);
          allWarns = allWarns.concat(warns);
        }

        setPreview(allGames);
        setWarnings(allWarns);

        // Build combined stats
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

  const buildScheduleForDiv = (divId, division, divTeams, rangeStart, rangeEnd) => {
    const warns = [];
    const targetGames = division?.games_per_team || 30;

    // Filter slots by season and optional date range
    let divSlots = slots.filter(s => !s.season || s.season === season);
    if (rangeStart) divSlots = divSlots.filter(s => s.date >= rangeStart);
    if (rangeEnd) divSlots = divSlots.filter(s => s.date <= rangeEnd);
    if (divSlots.length === 0) throw new Error(`No available ice slots found for ${division?.name || "division"} in the selected timeframe.`);

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

    const sortedSlots = [...divSlots].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const usedSlots = new Set();
    const teamGameDates = {};
    const teamLateCounts = {};
    divTeams.forEach(t => { teamGameDates[t.id] = []; teamLateCounts[t.id] = 0; });

    const teamBlackouts = {};
    const leagueBlackoutDates = new Set();
    blackouts.forEach(b => {
      if (!b.team_id || b.team_id === "league") {
        if (constraints.respectLeagueBlackouts) {
          let d = new Date(b.date_from);
          const end = new Date(b.date_to || b.date_from);
          while (d <= end) { leagueBlackoutDates.add(d.toISOString().split("T")[0]); d.setDate(d.getDate() + 1); }
        }
      } else {
        if (!teamBlackouts[b.team_id]) teamBlackouts[b.team_id] = [];
        teamBlackouts[b.team_id].push(b);
      }
    });

    const isTeamBlackedOut = (tid, date) => {
      if (!constraints.respectTeamBlackouts) return false;
      return (teamBlackouts[tid] || []).some(b => date >= b.date_from && date <= (b.date_to || b.date_from));
    };

    const scheduledGames = [];
    let unscheduled = 0;

    for (const [home, away] of allMatchups) {
      let assigned = false;
      for (const slot of sortedSlots) {
        if (usedSlots.has(slot.id)) continue;
        if (leagueBlackoutDates.has(slot.date)) continue;
        if (isTeamBlackedOut(home.id, slot.date) || isTeamBlackedOut(away.id, slot.date)) continue;
        if (constraints.noSameDay && (teamGameDates[home.id].includes(slot.date) || teamGameDates[away.id].includes(slot.date))) continue;
        if (constraints.noBackToBack) {
          const slotDate = new Date(slot.date);
          const before = new Date(slotDate); before.setDate(slotDate.getDate() - 1);
          const after = new Date(slotDate); after.setDate(slotDate.getDate() + 1);
          const bs = before.toISOString().split("T")[0], as_ = after.toISOString().split("T")[0];
          if (teamGameDates[home.id].includes(bs) || teamGameDates[home.id].includes(as_)) continue;
          if (teamGameDates[away.id].includes(bs) || teamGameDates[away.id].includes(as_)) continue;
        }
        if (slot.is_late_game) {
          const avgLate = Object.values(teamLateCounts).reduce((a, b) => a + b, 0) / divTeams.length;
          if (teamLateCounts[home.id] > avgLate + 2 || teamLateCounts[away.id] > avgLate + 2) continue;
        }

        usedSlots.add(slot.id);
        teamGameDates[home.id].push(slot.date);
        teamGameDates[away.id].push(slot.date);
        if (slot.is_late_game) { teamLateCounts[home.id]++; teamLateCounts[away.id]++; }

        scheduledGames.push({
          season, division_id: divId, division_name: division?.name,
          home_team_id: home.id, home_team_name: home.name,
          away_team_id: away.id, away_team_name: away.name,
          arena_id: slot.arena_id, arena_name: slot.arena_name,
          date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
          is_late_game: slot.is_late_game || false,
          game_type: "regular", status: "scheduled", ice_slot_id: slot.id,
        });
        assigned = true;
        break;
      }
      if (!assigned) unscheduled++;
    }

    if (unscheduled > 0) warns.push(`${division?.name}: ${unscheduled} matchup(s) could not be scheduled.`);
    if (constraints.maxDaysBetweenGames > 0) {
      divTeams.forEach(team => {
        const dates = teamGameDates[team.id].sort();
        for (let i = 1; i < dates.length; i++) {
          const gap = daysBetween(dates[i - 1], dates[i]);
          if (gap > constraints.maxDaysBetweenGames)
            warns.push(`${team.name}: ${gap}-day gap between ${dates[i-1]} and ${dates[i]}`);
        }
      });
    }
    return { games: scheduledGames, warns };
  };

  const saveSchedule = async () => {
    if (!preview.length) return;
    setGenerating(true);
    // Bulk-create games in chunks of 50 to avoid rate limits
    const CHUNK = 50;
    for (let i = 0; i < preview.length; i += CHUNK) {
      await base44.entities.Game.bulkCreate(preview.slice(i, i + CHUNK));
    }
    // Mark ice slots unavailable in batches of 10 with a small delay between batches
    const slotIds = [...new Set(preview.map(g => g.ice_slot_id).filter(Boolean))];
    const SLOT_CHUNK = 10;
    for (let i = 0; i < slotIds.length; i += SLOT_CHUNK) {
      await Promise.all(slotIds.slice(i, i + SLOT_CHUNK).map(id =>
        base44.entities.IceSlot.update(id, { is_available: false })
      ));
      if (i + SLOT_CHUNK < slotIds.length) await new Promise(r => setTimeout(r, 300));
    }
    setResult({ saved: true, count: preview.length });
    setPreview([]); setStats(null); setWarnings([]);
    setGenerating(false);
  };

  const clearDivisionSchedule = async (divId) => {
    const div = divisions.find(d => d.id === divId);
    if (!confirm(`Delete all regular season games for ${div?.name}?`)) return;
    const toDelete = existingGames.filter(g => g.division_id === divId && g.game_type === "regular");
    // Delete games in parallel batches of 10
    const CHUNK = 10;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      await Promise.all(toDelete.slice(i, i + CHUNK).map(g => base44.entities.Game.delete(g.id)));
      if (i + CHUNK < toDelete.length) await new Promise(r => setTimeout(r, 200));
    }
    // Restore slot availability in batches
    const slotIds = [...new Set(toDelete.map(g => g.ice_slot_id).filter(Boolean))];
    for (let i = 0; i < slotIds.length; i += CHUNK) {
      await Promise.all(slotIds.slice(i, i + CHUNK).map(id =>
        base44.entities.IceSlot.update(id, { is_available: true })
      ));
      if (i + CHUNK < slotIds.length) await new Promise(r => setTimeout(r, 200));
    }
    const g = await base44.entities.Game.list();
    setExistingGames(g);
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule Builder</h1>
        <p className="text-gray-400 text-sm mt-1">Generate balanced schedules for one or multiple divisions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="space-y-4">
          {/* Main config */}
          <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Settings className="w-4 h-4 text-sky-400" /> Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Season</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={season} onChange={e => setSeason(e.target.value)} />
              </div>

              {/* Multi-division selector */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Divisions *</label>
                <div className="relative">
                  <button onClick={() => setDivDropOpen(!divDropOpen)}
                    className="w-full flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none hover:border-sky-500 transition-colors">
                    <span className={selectedDivIds.length === 0 ? "text-gray-500" : "text-white"}>
                      {selectedDivIds.length === 0 ? "Select divisions..." :
                       selectedDivIds.length === divisions.length ? "All divisions" :
                       `${selectedDivIds.length} division${selectedDivIds.length > 1 ? "s" : ""} selected`}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  {divDropOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e2533] border border-gray-700 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                      <button onClick={selectAllDivs} className="w-full text-left px-3 py-2 text-xs text-sky-400 hover:bg-white/5 border-b border-gray-700">
                        {selectedDivIds.length === divisions.length ? "Deselect All" : "Select All Divisions"}
                      </button>
                      {divisions.map(d => (
                        <button key={d.id} onClick={() => toggleDiv(d.id)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/5 ${selectedDivIds.includes(d.id) ? "text-sky-400" : "text-gray-300"}`}>
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedDivIds.includes(d.id) ? "bg-sky-500 border-sky-500" : "border-gray-600"}`}>
                            {selectedDivIds.includes(d.id) && <CheckCircle className="w-3 h-3 text-white" />}
                          </span>
                          {d.name}
                          <span className="text-xs text-gray-500 ml-auto">{teams.filter(t => t.division_id === d.id).length} teams</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeframe */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Schedule Timeframe</label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {TIMEFRAME_OPTIONS.map(opt => (
                    <button key={opt.label} onClick={() => setTimeframe(opt.label)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${timeframe === opt.label ? "bg-sky-500 border-sky-500 text-white" : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {timeframe === "Custom Dates" && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">From</label>
                      <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500"
                        value={customStart} onChange={e => setCustomStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">To</label>
                      <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500"
                        value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                    </div>
                  </div>
                )}
                {rangeStart && rangeEnd && timeframe !== "Custom Dates" && (
                  <p className="text-xs text-gray-500 mt-1">Slots from {rangeStart} to {rangeEnd}</p>
                )}
              </div>

              {/* Summary per selected div */}
              {selectedDivIds.length > 0 && (
                <div className="space-y-2">
                  {selectedDivIds.map(divId => {
                    const div = divisions.find(d => d.id === divId);
                    const divTeams = teams.filter(t => t.division_id === divId);
                    const divExisting = existingGames.filter(g => g.division_id === divId);
                    return (
                      <div key={divId} className="bg-gray-900/50 rounded-lg p-3 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-white">{div?.name}</span>
                          {divExisting.length > 0 && (
                            <button onClick={() => clearDivisionSchedule(divId)}
                              className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs">
                              <Trash2 className="w-3 h-3" /> Clear
                            </button>
                          )}
                        </div>
                        <div className="space-y-0.5 text-gray-400">
                          <div className="flex justify-between"><span>Teams:</span><span className="text-white">{divTeams.length}</span></div>
                          <div className="flex justify-between"><span>Games/team:</span><span className="text-white">{div?.games_per_team || 30}</span></div>
                          {divExisting.length > 0 && <div className="flex justify-between"><span>Existing:</span><span className="text-yellow-400">{divExisting.length}</span></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={() => { setDivDropOpen(false); generateSchedule(); }}
                disabled={generating || selectedDivIds.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                {generating ? "Generating..." : `Generate${selectedDivIds.length > 1 ? ` (${selectedDivIds.length} divs)` : ""}`}
              </button>
            </div>
          </div>

          {/* Constraints */}
          <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Scheduling Rules</h2>
            <div className="space-y-3">
              {[
                { key: "noSameDay", label: "No same-day games per team" },
                { key: "noBackToBack", label: "No back-to-back day games" },
                { key: "respectTeamBlackouts", label: "Respect team blackout dates" },
                { key: "respectLeagueBlackouts", label: "Respect league blackout dates" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={constraints[key]}
                    onChange={e => setConstraints(c => ({ ...c, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-sky-500" />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Max days between games</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={30}
                    className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={constraints.maxDaysBetweenGames}
                    onChange={e => setConstraints(c => ({ ...c, maxDaysBetweenGames: parseInt(e.target.value) || 0 }))} />
                  <span className="text-sm text-gray-400">days (0 = no limit)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {result?.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div><p className="text-red-400 font-medium">Error</p><p className="text-red-300 text-sm mt-1">{result.error}</p></div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-medium text-sm">{warnings.length} Warning{warnings.length > 1 ? "s" : ""}</span>
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {warnings.map((w, i) => <li key={i} className="text-yellow-300 text-xs">• {w}</li>)}
              </ul>
            </div>
          )}

          {result?.success && stats && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">{result.count} games generated across {stats.divCount} division{stats.divCount > 1 ? "s" : ""} — review before saving</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{stats.total}</div>
                  <div className="text-xs text-gray-400">Total Games</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1"><Moon className="w-4 h-4" />{stats.lateGames}</div>
                  <div className="text-xs text-gray-400">Late Games</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-sky-400">{stats.divCount}</div>
                  <div className="text-xs text-gray-400">Divisions</div>
                </div>
              </div>
              <button onClick={saveSchedule} disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-medium text-sm transition-colors">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save {result.count} Games to Schedule
              </button>
            </div>
          )}

          {result?.saved && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400">{result.count} games saved successfully!</span>
            </div>
          )}

          {/* Preview grouped by division */}
          {preview.length > 0 && (
            <div className="bg-[#1e2533] rounded-xl border border-gray-800 overflow-hidden">
              <div className="border-b border-gray-700 px-4 py-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-medium text-white">Preview — First 30 of {preview.length} games</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Division</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Date</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Time</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Matchup</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Arena</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {preview.slice(0, 30).map((g, i) => (
                      <tr key={i} className="hover:bg-white/2">
                        <td className="px-4 py-2 text-xs text-sky-400">{g.division_name}</td>
                        <td className="px-4 py-2 text-sm text-white whitespace-nowrap">{g.date}</td>
                        <td className="px-4 py-2 text-sm text-gray-400 whitespace-nowrap flex items-center gap-1">
                          {g.start_time} {g.is_late_game && <Moon className="w-3 h-3 text-yellow-400" />}
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
        </div>
      </div>
    </div>
  );
}