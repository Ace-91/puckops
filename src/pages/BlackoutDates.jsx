import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLeague } from "@/components/useLeague";
import { Plus, X, CheckCircle, XCircle, AlertTriangle, Globe, Users } from "lucide-react";

export default function BlackoutDates() {
  const { leagueId } = useLeague();
  const [blackouts, setBlackouts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterType, setFilterType] = useState("all"); // "all" | "team" | "league"

  const [form, setForm] = useState({
    is_league: false,
    team_id: "", date_from: "", date_to: "", reason: "",
    time_restriction: "none", specific_time_notes: "", season: "2025-2026"
  });

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      const q = leagueId ? { league_id: leagueId } : {};
      const [b, t] = await Promise.all([base44.entities.BlackoutDate.filter(q, "-created_date"), base44.entities.Team.filter(q)]);
      setBlackouts(b);
      setTeams(t);
      setLoading(false);
    };
    if (leagueId !== undefined) load();
  }, [leagueId]);

  const isAdmin = user?.role === "admin" || user?.role === "referee_coordinator";
  const myTeams = isAdmin ? teams : teams.filter(t => t.manager_email === user?.email);

  const reload = async () => {
    const q = leagueId ? { league_id: leagueId } : {};
    const b = await base44.entities.BlackoutDate.filter(q, "-created_date");
    setBlackouts(b);
  };

  const submit = async () => {
    if (form.is_league) {
      if (!form.date_from) { alert("Start date is required."); return; }
    } else {
      if (!form.team_id || !form.date_from) { alert("Team and start date are required."); return; }
    }
    const team = teams.find(t => t.id === form.team_id);
    await base44.entities.BlackoutDate.create({
      league_id: leagueId || "",
      team_id: form.is_league ? "league" : form.team_id,
      team_name: form.is_league ? "LEAGUE" : (team?.name || ""),
      division_id: form.is_league ? "" : (team?.division_id || ""),
      date_from: form.date_from,
      date_to: form.date_to || form.date_from,
      reason: form.reason,
      time_restriction: form.is_league ? "none" : form.time_restriction,
      specific_time_notes: form.specific_time_notes,
      season: form.season,
      submitted_by: user?.email,
      status: form.is_league ? "approved" : "pending", // league blackouts auto-approved
    });
    setShowForm(false);
    resetForm();
    reload();
  };

  const resetForm = () => setForm({
    is_league: false, team_id: "", date_from: "", date_to: "", reason: "",
    time_restriction: "none", specific_time_notes: "", season: "2025-2026"
  });

  const updateStatus = async (id, status) => {
    await base44.entities.BlackoutDate.update(id, { status });
    reload();
  };

  const deleteBlackout = async (id) => {
    if (!confirm("Delete this blackout date?")) return;
    await base44.entities.BlackoutDate.delete(id);
    reload();
  };

  const isLeagueBlackout = (b) => b.team_id === "league" || !b.team_id;

  const filtered = blackouts.filter(b => {
    const typeMatch = filterType === "all" || (filterType === "league" ? isLeagueBlackout(b) : !isLeagueBlackout(b));
    const statusMatch = filterStatus === "all" || b.status === filterStatus;
    const teamMatch = filterTeam === "all" || b.team_id === filterTeam;
    const accessMatch = isAdmin || b.submitted_by === user?.email || myTeams.some(t => t.id === b.team_id);
    return typeMatch && statusMatch && teamMatch && accessMatch;
  });

  const statusBadge = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    approved: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Blackout Dates</h1>
          <p className="text-gray-400 text-sm mt-1">Team and league-wide scheduling restrictions</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Blackout
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Pending Review", count: blackouts.filter(b => b.status === "pending").length, color: "text-yellow-400" },
          { label: "Approved", count: blackouts.filter(b => b.status === "approved").length, color: "text-green-400" },
          { label: "Rejected", count: blackouts.filter(b => b.status === "rejected").length, color: "text-red-400" },
          { label: "League Blackouts", count: blackouts.filter(isLeagueBlackout).length, color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#1e2533] rounded-xl p-4 border border-gray-800 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="team">Team Blackouts</option>
          <option value="league">League Blackouts</option>
        </select>
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {isAdmin && (
          <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
            value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-20 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => (
            <div key={b.id} className={`bg-[#1e2533] rounded-xl border p-4 ${isLeagueBlackout(b) ? "border-purple-500/30" : "border-gray-800"}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {isLeagueBlackout(b) ? (
                      <span className="flex items-center gap-1.5 font-semibold text-purple-300"><Globe className="w-4 h-4" /> League-Wide Blackout</span>
                    ) : (
                      <span className="flex items-center gap-1.5 font-semibold text-white"><Users className="w-4 h-4 text-gray-400" /> {b.team_name}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[b.status]}`}>{b.status}</span>
                    {!isLeagueBlackout(b) && b.time_restriction !== "none" && (
                      <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                        {b.time_restriction === "no_late_games" ? "No Late Games" : "Time Restricted"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-300">
                    📅 <span className="font-medium">{b.date_from}</span>
                    {b.date_to && b.date_to !== b.date_from && <span> → <span className="font-medium">{b.date_to}</span></span>}
                  </div>
                  {b.reason && <div className="text-sm text-gray-400 mt-1">{b.reason}</div>}
                  {b.specific_time_notes && <div className="text-xs text-orange-300 mt-1">⏰ {b.specific_time_notes}</div>}
                  <div className="text-xs text-gray-500 mt-1">Submitted by {b.submitted_by} · {b.created_date?.split("T")[0]}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {isAdmin && b.status === "pending" && !isLeagueBlackout(b) && (
                    <>
                      <button onClick={() => updateStatus(b.id, "approved")} className="p-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors" title="Approve">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => updateStatus(b.id, "rejected")} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors" title="Reject">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {(isAdmin || b.submitted_by === user?.email) && (
                    <button onClick={() => deleteBlackout(b.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No blackout dates found.</p>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Blackout Date</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Toggle: team vs league */}
            {isAdmin && (
              <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-4">
                <button onClick={() => setForm(f => ({ ...f, is_league: false }))}
                  className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${!form.is_league ? "bg-sky-500 text-white" : "bg-gray-900 text-gray-400 hover:text-white"}`}>
                  <Users className="w-4 h-4" /> Team Blackout
                </button>
                <button onClick={() => setForm(f => ({ ...f, is_league: true, team_id: "" }))}
                  className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${form.is_league ? "bg-purple-500 text-white" : "bg-gray-900 text-gray-400 hover:text-white"}`}>
                  <Globe className="w-4 h-4" /> League Blackout
                </button>
              </div>
            )}

            {form.is_league && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4 text-xs text-purple-300">
                League blackouts block <strong>all teams</strong> from being scheduled on these dates. They are auto-approved and applied immediately to schedule generation.
              </div>
            )}

            <div className="space-y-4">
              {!form.is_league && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Team *</label>
                  <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
                    <option value="">Select team...</option>
                    {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">From Date *</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">To Date</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
                </div>
              </div>
              {!form.is_league && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Time Restriction</label>
                  <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.time_restriction} onChange={e => setForm(f => ({ ...f, time_restriction: e.target.value }))}>
                    <option value="none">No restriction</option>
                    <option value="no_late_games">No late games (10:30pm+)</option>
                    <option value="specific_times">Specific time restrictions</option>
                  </select>
                </div>
              )}
              {form.time_restriction === "specific_times" && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Specify Time Notes</label>
                  <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.specific_time_notes} onChange={e => setForm(f => ({ ...f, specific_time_notes: e.target.value }))}
                    placeholder="e.g. Cannot play before 6pm" />
                </div>
              )}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Reason</label>
                <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-20 resize-none"
                  value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder={form.is_league ? "e.g. Christmas holiday, long weekend..." : "Tournament, school break, etc."} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={submit} className={`flex-1 py-2 rounded-lg text-white text-sm font-medium ${form.is_league ? "bg-purple-500 hover:bg-purple-600" : "bg-sky-500 hover:bg-sky-600"}`}>
                {form.is_league ? "Add League Blackout" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}