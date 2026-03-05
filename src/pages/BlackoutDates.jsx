import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, X, CheckCircle, XCircle, AlertTriangle, Filter } from "lucide-react";

export default function BlackoutDates() {
  const [blackouts, setBlackouts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");

  const [form, setForm] = useState({
    team_id: "", date_from: "", date_to: "", reason: "",
    time_restriction: "none", specific_time_notes: "", season: "2025-2026"
  });

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      const [b, t] = await Promise.all([base44.entities.BlackoutDate.list("-created_date"), base44.entities.Team.list()]);
      setBlackouts(b);
      setTeams(t);
      setLoading(false);
    };
    load();
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "referee_coordinator";

  const myTeams = isAdmin ? teams : teams.filter(t => t.manager_email === user?.email);

  const submit = async () => {
    if (!form.team_id || !form.date_from) { alert("Team and start date are required."); return; }
    const team = teams.find(t => t.id === form.team_id);
    await base44.entities.BlackoutDate.create({
      ...form,
      team_name: team?.name,
      division_id: team?.division_id,
      submitted_by: user?.email,
      status: "pending",
    });
    setShowForm(false);
    setForm({ team_id: "", date_from: "", date_to: "", reason: "", time_restriction: "none", specific_time_notes: "", season: "2025-2026" });
    const b = await base44.entities.BlackoutDate.list("-created_date");
    setBlackouts(b);
  };

  const updateStatus = async (id, status) => {
    await base44.entities.BlackoutDate.update(id, { status });
    const b = await base44.entities.BlackoutDate.list("-created_date");
    setBlackouts(b);
  };

  const deleteBlackout = async (id) => {
    await base44.entities.BlackoutDate.delete(id);
    const b = await base44.entities.BlackoutDate.list("-created_date");
    setBlackouts(b);
  };

  const filtered = blackouts.filter(b =>
    (filterStatus === "all" || b.status === filterStatus) &&
    (filterTeam === "all" || b.team_id === filterTeam) &&
    (isAdmin || b.submitted_by === user?.email || myTeams.some(t => t.id === b.team_id))
  );

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
          <p className="text-gray-400 text-sm mt-1">Teams submit dates when they cannot play</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Submit Blackout
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending Review", count: blackouts.filter(b => b.status === "pending").length, color: "text-yellow-400" },
          { label: "Approved", count: blackouts.filter(b => b.status === "approved").length, color: "text-green-400" },
          { label: "Rejected", count: blackouts.filter(b => b.status === "rejected").length, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#1e2533] rounded-xl p-4 border border-gray-800 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
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
            <div key={b.id} className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-white">{b.team_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[b.status]}`}>{b.status}</span>
                    {b.time_restriction !== "none" && (
                      <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                        {b.time_restriction === "no_late_games" ? "No Late Games" : "Time Restricted"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-300">
                    <span className="font-medium">{b.date_from}</span>
                    {b.date_to && b.date_to !== b.date_from && <span> → {b.date_to}</span>}
                  </div>
                  {b.reason && <div className="text-sm text-gray-400 mt-1">{b.reason}</div>}
                  {b.specific_time_notes && <div className="text-xs text-orange-300 mt-1">⏰ {b.specific_time_notes}</div>}
                  <div className="text-xs text-gray-500 mt-1">Submitted by {b.submitted_by} · {b.created_date?.split("T")[0]}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {isAdmin && b.status === "pending" && (
                    <>
                      <button onClick={() => updateStatus(b.id, "approved")} className="p-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors" title="Approve">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => updateStatus(b.id, "rejected")} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors" title="Reject">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteBlackout(b.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
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

      {/* Submit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Submit Blackout Date</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Team *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
                  <option value="">Select team...</option>
                  {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
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
              <div>
                <label className="text-sm text-gray-400 block mb-1">Time Restriction</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.time_restriction} onChange={e => setForm(f => ({ ...f, time_restriction: e.target.value }))}>
                  <option value="none">No restriction</option>
                  <option value="no_late_games">No late games (10:30pm+)</option>
                  <option value="specific_times">Specific time restrictions</option>
                </select>
              </div>
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
                  placeholder="Tournament, holidays, etc." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={submit} className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg text-white text-sm font-medium">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}