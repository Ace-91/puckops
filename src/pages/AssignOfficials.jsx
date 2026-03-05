import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Shield, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function AssignOfficials() {
  const [games, setGames] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDiv, setFilterDiv] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [assigning, setAssigning] = useState(null); // game id
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const [g, o, a, d] = await Promise.all([
        base44.entities.Game.filter({ status: "scheduled" }),
        base44.entities.Official.filter({ is_active: true }),
        base44.entities.OfficialAvailability.list(),
        base44.entities.Division.list(),
      ]);
      setGames(g.filter(game => game.date >= today));
      setOfficials(o);
      setAvailability(a);
      setDivisions(d);
      setLoading(false);
    };
    load();
  }, []);

  const isAvailable = (officialId, date) => {
    const dayAvail = availability.filter(a => a.official_id === officialId && a.date === date);
    if (dayAvail.some(a => a.is_unavailable)) return false;
    return true;
  };

  const gamesAssignedOnDate = (officialId, date) => {
    return games.filter(g => g.date === date && (g.referee1_id === officialId || g.referee2_id === officialId || g.timekeeper_id === officialId)).length;
  };

  const assignOfficial = async (game, field, officialId, officialName) => {
    setSaving(true);
    await base44.entities.Game.update(game.id, { [field]: officialId, [`${field.replace("_id","_name")}`]: officialName });
    const g = await base44.entities.Game.filter({ status: "scheduled" });
    setGames(g);
    setSaving(false);
  };

  const filtered = games.filter(g =>
    (filterDiv === "all" || g.division_id === filterDiv) &&
    (!filterDate || g.date === filterDate) &&
    (!filterUnassigned || !g.referee1_id || !g.referee2_id || !g.timekeeper_id)
  );

  const refs = officials.filter(o => o.role === "referee");
  const tks = officials.filter(o => o.role === "timekeeper");

  const OfficialSelect = ({ game, field, officials: pool, label, icon: Icon }) => {
    const currentId = game[field];
    const currentName = game[`${field.replace("_id","_name")}`];
    return (
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-sky-500 flex-1 min-w-0"
          value={currentId || ""}
          onChange={e => {
            const o = pool.find(x => x.id === e.target.value);
            assignOfficial(game, field, e.target.value, o?.full_name || "");
          }}
        >
          <option value="">— {label} —</option>
          {pool.map(o => {
            const avail = isAvailable(o.id, game.date);
            const count = gamesAssignedOnDate(o.id, game.date);
            return (
              <option key={o.id} value={o.id} disabled={!avail}>
                {o.full_name} {!avail ? "❌" : count > 0 ? `(${count} games)` : "✓"}
              </option>
            );
          })}
        </select>
      </div>
    );
  };

  const unassigned = games.filter(g => !g.referee1_id || !g.referee2_id || !g.timekeeper_id).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Assign Officials</h1>
          <p className="text-gray-400 text-sm mt-1">{unassigned} games missing officials</p>
        </div>
        {unassigned > 0 && (
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <span className="text-orange-300 text-sm">{unassigned} unassigned</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterDiv} onChange={e => setFilterDiv(e.target.value)}>
          <option value="all">All Divisions</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="date" className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <label className="flex items-center gap-2 cursor-pointer bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2">
          <input type="checkbox" checked={filterUnassigned} onChange={e => setFilterUnassigned(e.target.checked)} className="accent-sky-500" />
          <span className="text-sm text-gray-300">Show unassigned only</span>
        </label>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-24 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(game => {
            const fullyAssigned = game.referee1_id && game.referee2_id && game.timekeeper_id;
            return (
              <div key={game.id} className={`bg-[#1e2533] rounded-xl border p-4 ${fullyAssigned ? "border-green-500/20" : "border-orange-500/20"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-white text-sm">{game.home_team_name} <span className="text-gray-500">vs</span> {game.away_team_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{game.date} · {game.start_time} · {game.arena_name} · {game.division_name}</div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${fullyAssigned ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"}`}>
                    {fullyAssigned ? <><CheckCircle className="w-3 h-3" /> Assigned</> : <><AlertCircle className="w-3 h-3" /> Needs Officials</>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <OfficialSelect game={game} field="referee1_id" officials={refs} label="Referee 1" icon={Shield} />
                  <OfficialSelect game={game} field="referee2_id" officials={refs} label="Referee 2" icon={Shield} />
                  <OfficialSelect game={game} field="timekeeper_id" officials={tks} label="Timekeeper" icon={Clock} />
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center py-12 text-gray-500">No games to display.</p>}
        </div>
      )}
    </div>
  );
}