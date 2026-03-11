import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, CheckCircle, AlertTriangle, Save } from "lucide-react";

const STATUS_COLORS = {
  trial: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const PLAN_LABELS = { trial: "Trial", starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

export default function LeagueSettings() {
  const [league, setLeague] = useState(null);
  const [form, setForm] = useState({ name: "", city: "", logo_url: "", external_id: "", puckleague_sync_enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      if (u?.league_id) {
        const leagues = await base44.entities.League.list();
        const myLeague = leagues.find(l => l.id === u.league_id);
        if (myLeague) {
          setLeague(myLeague);
          setForm({ name: myLeague.name || "", city: myLeague.city || "", logo_url: myLeague.logo_url || "", external_id: myLeague.external_id || "", puckleague_sync_enabled: myLeague.puckleague_sync_enabled || false });
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    if (!league) return;
    setSaving(true);
    await base44.entities.League.update(league.id, form);
    setLeague(prev => ({ ...prev, ...form }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputCls = "w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500";

  if (loading) return <div className="h-48 rounded-xl animate-pulse" style={{ background: "#111" }} />;

  if (!league) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500 opacity-40" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white mb-1">No League Assigned</h2>
          <p className="text-gray-400 text-sm max-w-sm">Your account hasn't been linked to a league yet. Contact the platform administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="w-5 h-5" style={{ color: "#c0c0c0" }} />
        <h1 className="text-2xl font-bold text-white">League Settings</h1>
      </div>

      {/* Plan / Status banner */}
      <div className="rounded-xl p-5 mb-6 border border-gray-800 flex items-center justify-between flex-wrap gap-4" style={{ background: "#111" }}>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Current Plan</div>
          <div className="text-xl font-bold" style={{ color: "#d4af37" }}>{PLAN_LABELS[league.plan] || league.plan}</div>
          {league.trial_ends && league.status === "trial" && (
            <div className="text-xs text-yellow-400 mt-1">Trial ends {league.trial_ends}</div>
          )}
        </div>
        <span className={`text-sm px-3 py-1 rounded-full border font-medium ${STATUS_COLORS[league.status] || STATUS_COLORS.trial}`}>
          {league.status?.charAt(0).toUpperCase() + league.status?.slice(1)}
        </span>
      </div>

      {/* Editable settings */}
      <div className="rounded-xl border border-gray-800 p-6 space-y-4 mb-4" style={{ background: "#111" }}>
        <h2 className="text-sm font-semibold text-white">League Information</h2>
        <div>
          <label className="text-xs text-gray-400 block mb-1">League Name</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">City / Location</label>
          <input className={inputCls} placeholder="e.g. Winnipeg, MB" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Logo URL</label>
          <input className={inputCls} placeholder="https://..." value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} />
          {form.logo_url && (
            <img src={form.logo_url} alt="Logo preview" className="mt-2 h-12 object-contain rounded" onError={e => e.target.style.display = "none"} />
          )}
        </div>
        <div className="border-t border-gray-800 pt-4">
          <div className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Cross-Platform Sync</div>
          <label className="text-xs text-gray-400 block mb-1">PuckLeague External ID</label>
          <input className={inputCls} placeholder="Paste your PuckLeague league ID here to link platforms..."
            value={form.external_id} onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))} />
          <p className="text-xs text-gray-600 mt-1">If you also use PuckLeague, paste the matching league ID from that platform. This allows future data sync between both systems.</p>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input type="checkbox" checked={form.puckleague_sync_enabled}
              onChange={e => setForm(f => ({ ...f, puckleague_sync_enabled: e.target.checked }))}
              style={{ accentColor: "#d4af37" }} className="w-4 h-4" />
            <span className="text-sm text-gray-300">Enable PuckLeague sync</span>
          </label>
          {form.puckleague_sync_enabled && !form.external_id && (
            <p className="text-xs text-yellow-500 mt-1">⚠ Enter your PuckLeague ID above to activate sync.</p>
          )}
          {form.puckleague_sync_enabled && form.external_id && (
            <p className="text-xs text-green-400 mt-1">✓ Platforms linked — sync ready.</p>
          )}
        </div>
        <div className="pt-2">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-black disabled:opacity-50 transition-colors"
            style={{ background: "#c0c0c0" }}>
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>

      {/* League ID */}
      <div className="rounded-xl border border-gray-800 p-4" style={{ background: "#111" }}>
        <div className="text-xs text-gray-500 mb-1">League ID (for support)</div>
        <code className="text-xs text-gray-400 font-mono break-all">{league.id}</code>
      </div>
    </div>
  );
}