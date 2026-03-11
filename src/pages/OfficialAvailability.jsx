import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLeague } from "@/components/useLeague";
import { Plus, X, CalendarX, CheckCircle } from "lucide-react";

export default function OfficialAvailability() {
  const { leagueId } = useLeague();
  const [user, setUser] = useState(null);
  const [myOfficial, setMyOfficial] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewAs, setViewAs] = useState(null); // admin can view any official
  const [form, setForm] = useState({ date: "", available_from: "", available_to: "", is_unavailable: false, notes: "", season: "2025-2026" });

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      const q = leagueId ? { league_id: leagueId } : {};
      const [offs, avails] = await Promise.all([base44.entities.Official.filter(q), base44.entities.OfficialAvailability.filter(q, "-date", 200)]);
      setOfficials(offs);
      const mine = offs.find(o => o.user_email === u?.email);
      setMyOfficial(mine);
      setAvailability(avails);
      setLoading(false);
    };
    if (leagueId !== undefined) load();
  }, [leagueId]);

  const isAdmin = user?.role === "admin" || user?.role === "referee_coordinator";
  const displayOfficial = viewAs ? officials.find(o => o.id === viewAs) : myOfficial;
  const displayAvailability = availability.filter(a => a.official_id === (displayOfficial?.id));

  const submit = async () => {
    if (!displayOfficial) return;
    const q = leagueId ? { league_id: leagueId } : {};
    await base44.entities.OfficialAvailability.create({
      ...form,
      official_id: displayOfficial.id,
      official_name: displayOfficial.full_name,
      official_email: displayOfficial.user_email,
      league_id: leagueId || "",
    });
    setShowForm(false);
    setForm({ date: "", available_from: "", available_to: "", is_unavailable: false, notes: "", season: "2025-2026" });
    const avails = await base44.entities.OfficialAvailability.filter(q, "-date", 200);
    setAvailability(avails);
  };

  const del = async (id) => {
    await base44.entities.OfficialAvailability.delete(id);
    const q = leagueId ? { league_id: leagueId } : {};
    const avails = await base44.entities.OfficialAvailability.filter(q, "-date", 200);
    setAvailability(avails);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Official Availability</h1>
          <p className="text-gray-400 text-sm mt-1">Submit your availability and preferences</p>
        </div>
        {displayOfficial && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Availability
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="mb-4">
          <label className="text-sm text-gray-400 block mb-1">View Official</label>
          <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 w-64"
            value={viewAs || ""} onChange={e => setViewAs(e.target.value || null)}>
            <option value="">My Profile ({myOfficial?.full_name || "not set"})</option>
            {officials.map(o => <option key={o.id} value={o.id}>{o.full_name} ({o.role})</option>)}
          </select>
        </div>
      )}

      {!displayOfficial && !loading && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 text-center">
          <CalendarX className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
          <p className="text-yellow-300 font-medium">No official profile linked to your account.</p>
          <p className="text-yellow-400/70 text-sm mt-1">Please ask an admin to create your official profile with your email address.</p>
        </div>
      )}

      {displayOfficial && (
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-4 mb-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
            <span className="text-purple-400 font-bold">{displayOfficial.full_name?.[0]}</span>
          </div>
          <div>
            <div className="font-semibold text-white">{displayOfficial.full_name}</div>
            <div className="text-sm text-gray-400 capitalize">{displayOfficial.role} · {displayOfficial.certification_level} · Max {displayOfficial.max_games_per_week} games/week</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-16 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {displayAvailability.map(a => (
            <div key={a.id} className={`rounded-xl border p-4 flex items-center justify-between ${a.is_unavailable ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20"}`}>
              <div className="flex items-center gap-3">
                {a.is_unavailable ? <CalendarX className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
                <div>
                  <div className="font-medium text-white">{a.date} {a.is_unavailable ? <span className="text-red-400 text-sm">— Unavailable</span> : <span className="text-green-400 text-sm">— Available</span>}</div>
                  {!a.is_unavailable && a.available_from && <div className="text-sm text-gray-400">{a.available_from} – {a.available_to}</div>}
                  {a.notes && <div className="text-xs text-gray-500">{a.notes}</div>}
                </div>
              </div>
              <button onClick={() => del(a.id)} className="p-1 text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>
            </div>
          ))}
          {displayAvailability.length === 0 && displayOfficial && (
            <div className="text-center py-10 text-gray-500">No availability submitted yet.</div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Availability</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Date *</label>
                <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="unavail" checked={form.is_unavailable} onChange={e => setForm(f => ({ ...f, is_unavailable: e.target.checked }))} className="accent-red-500" />
                <label htmlFor="unavail" className="text-sm text-gray-300">Mark as Unavailable</label>
              </div>
              {!form.is_unavailable && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Available From</label>
                    <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                      value={form.available_from} onChange={e => setForm(f => ({ ...f, available_from: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Available To</label>
                    <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                      value={form.available_to} onChange={e => setForm(f => ({ ...f, available_to: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Notes</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={submit} className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}