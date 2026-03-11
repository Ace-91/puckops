import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Crown, Plus, Users, CheckCircle, XCircle, Pencil, Trash2, X, Building2, Calendar } from "lucide-react";

const STATUS_COLORS = {
  trial: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const PLAN_COLORS = {
  trial: "text-yellow-400",
  starter: "text-blue-400",
  pro: "text-purple-400",
  enterprise: "text-amber-300",
};

export default function LeagueManagement() {
  const [leagues, setLeagues] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLeague, setEditingLeague] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", owner_email: "", owner_name: "", city: "", plan: "trial", status: "trial", notes: "", external_id: "", puckleague_sync_enabled: false });

  const load = async () => {
    const [l, u] = await Promise.all([
      base44.entities.League.list("-created_date"),
      base44.entities.User.list(),
    ]);
    setLeagues(l);
    setAllUsers(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.owner_email) { alert("League name and owner email are required."); return; }
    setSaving(true);
    if (editingLeague) {
      await base44.entities.League.update(editingLeague.id, form);
    } else {
      const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      await base44.entities.League.create({ ...form, trial_ends: trialEnd });
      await base44.users.inviteUser(form.owner_email, "admin").catch(() => {});
      await base44.integrations.Core.SendEmail({
        to: form.owner_email,
        subject: `Welcome to PuckOperations — Your League "${form.name}" is Ready`,
        body: `Hello ${form.owner_name || ""},\n\nYour league "${form.name}" has been created on PuckOperations.\n\nYou've been invited as the League Administrator. Check your inbox for an invitation link to set up your account.\n\nYour 30-day trial runs until ${trialEnd}.\n\nOnce logged in you can:\n• Create divisions and add teams\n• Set up arenas and ice slots\n• Build your season schedule\n• Invite team managers and officials\n\nWelcome aboard!\n\nPuckOperations`,
      }).catch(() => {});
    }
    setSaving(false);
    closeForm();
    await load();
  };

  const updateStatus = async (league, status) => {
    await base44.entities.League.update(league.id, { status });
    setLeagues(prev => prev.map(l => l.id === league.id ? { ...l, status } : l));
  };

  const deleteLeague = async (league) => {
    if (!confirm(`Permanently delete "${league.name}"? This cannot be undone.`)) return;
    await base44.entities.League.delete(league.id);
    setLeagues(prev => prev.filter(l => l.id !== league.id));
  };

  const openEdit = (league) => {
    setEditingLeague(league);
    setForm({ name: league.name, owner_email: league.owner_email || "", owner_name: league.owner_name || "", city: league.city || "", plan: league.plan || "trial", status: league.status || "trial", notes: league.notes || "", external_id: league.external_id || "", puckleague_sync_enabled: league.puckleague_sync_enabled || false });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLeague(null);
    setForm({ name: "", owner_email: "", owner_name: "", city: "", plan: "trial", status: "trial", notes: "" });
  };

  const leagueUserCount = (leagueId) => allUsers.filter(u => u.league_id === leagueId).length;

  const stats = {
    total: leagues.length,
    active: leagues.filter(l => l.status === "active").length,
    trial: leagues.filter(l => l.status === "trial").length,
    suspended: leagues.filter(l => l.status === "suspended").length,
  };

  const inputCls = "w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5" style={{ color: "#d4af37" }} />
            <h1 className="text-2xl font-bold text-white">League Management</h1>
          </div>
          <p className="text-gray-400 text-sm">Manage all leagues on the PuckOperations platform</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black"
          style={{ background: "#d4af37" }}>
          <Plus className="w-4 h-4" /> Add League
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Leagues", value: stats.total, color: "text-white" },
          { label: "Active", value: stats.active, color: "text-green-400" },
          { label: "Trial", value: stats.trial, color: "text-yellow-400" },
          { label: "Suspended", value: stats.suspended, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 border border-gray-800 text-center" style={{ background: "#111" }}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Leagues list */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#111" }} />)}</div>
      ) : (
        <div className="space-y-3">
          {leagues.map(league => (
            <div key={league.id} className="rounded-xl border border-gray-800 p-4" style={{ background: "#111" }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-semibold text-white text-base">{league.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[league.status] || STATUS_COLORS.trial}`}>
                      {league.status}
                    </span>
                    <span className={`text-xs font-bold uppercase ${PLAN_COLORS[league.plan] || "text-gray-400"}`}>
                      {league.plan}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">
                    {league.owner_name && `${league.owner_name} · `}{league.owner_email}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-4">
                    {league.city && <span>{league.city}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{leagueUserCount(league.id)} users</span>
                    {league.trial_ends && league.status === "trial" && (
                      <span className="flex items-center gap-1 text-yellow-500">
                        <Calendar className="w-3 h-3" /> Trial ends {league.trial_ends}
                      </span>
                    )}
                    {league.external_id && (
                      <span className="flex items-center gap-1 text-blue-400 text-xs">
                        🔗 Linked
                        {league.puckleague_sync_enabled && <span className="text-green-400 ml-1">· Sync ON</span>}
                      </span>
                    )}
                  </div>
                  {league.notes && <div className="text-xs text-gray-500 mt-1 italic">{league.notes}</div>}
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {league.status === "active" ? (
                    <button onClick={() => updateStatus(league, "suspended")}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-700/40 text-red-400 hover:bg-red-500/10 transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Suspend
                    </button>
                  ) : (
                    <button onClick={() => updateStatus(league, "active")}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-700/40 text-green-400 hover:bg-green-500/10 transition-colors">
                      <CheckCircle className="w-3.5 h-3.5" /> Activate
                    </button>
                  )}
                  <button onClick={() => openEdit(league)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => deleteLeague(league)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-900/40 text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {leagues.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No leagues yet. Create your first league above.</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-700 p-6 w-full max-w-lg" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">{editingLeague ? "Edit League" : "Add New League"}</h2>
              <button onClick={closeForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">League Name *</label>
                <input className={inputCls} placeholder="e.g. Winnipeg Adult Hockey League" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Owner Email *</label>
                  <input className={inputCls} type="email" placeholder="admin@league.com" value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Owner Name</label>
                  <input className={inputCls} placeholder="John Smith" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">City / Location</label>
                  <input className={inputCls} placeholder="Winnipeg, MB" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Plan</label>
                  <select className={inputCls} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                    <option value="trial">Trial (30 days free)</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Status</label>
                <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Internal Notes</label>
                <input className={inputCls} placeholder="Optional internal notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="border-t border-gray-800 pt-3">
                <div className="text-xs text-gray-500 mb-2 font-medium">Cross-Platform Sync</div>
                <label className="text-xs text-gray-400 block mb-1">External / PuckLeague ID</label>
                <input className={inputCls} placeholder="Paste matching ID from PuckLeague..." value={form.external_id} onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))} />
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={form.puckleague_sync_enabled}
                    onChange={e => setForm(f => ({ ...f, puckleague_sync_enabled: e.target.checked }))}
                    style={{ accentColor: "#d4af37" }} className="w-4 h-4" />
                  <span className="text-xs text-gray-300">PuckLeague sync enabled</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={closeForm} className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-black text-sm font-medium disabled:opacity-50"
                style={{ background: "#d4af37" }}>
                {saving ? "Saving..." : editingLeague ? "Save Changes" : "Create League & Invite Owner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}