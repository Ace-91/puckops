import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, X, Pencil, Trash2, Shield, Clock } from "lucide-react";

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

// Referee stripe avatar
function RefStripes({ name, size = 36 }) {
  const initials = (name || "?")[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #444", position: "relative", background: "#111" }}>
      {/* Black & white vertical stripes */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={i} x={i * (size / 6)} y={0} width={size / 6} height={size} fill={i % 2 === 0 ? "#111" : "#e0e0e0"} />
        ))}
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: size * 0.36, color: "#d4af37", textShadow: "0 1px 2px #000", zIndex: 1 }}>
        {initials}
      </span>
    </div>
  );
}

// Timekeeper avatar (solid dark with gold clock)
function TKAvatar({ name, size = 36 }) {
  const initials = (name || "?")[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #444", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: size * 0.36, color: GOLD }}>
      {initials}
    </div>
  );
}

const emptyForm = { full_name: "", user_email: "", phone: "", role: "referee", certification_level: "level2", preferred_divisions: [], max_games_per_week: 5, notes: "", is_active: true, approval_status: "approved" };

export default function Officials() {
  const [officials, setOfficials] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterRole, setFilterRole] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [o, d] = await Promise.all([base44.entities.Official.list(), base44.entities.Division.list()]);
      setOfficials(o);
      setDivisions(d);
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    if (editing) {
      await base44.entities.Official.update(editing.id, form);
    } else {
      await base44.entities.Official.create(form);
    }
    setShowForm(false); setEditing(null); setForm(emptyForm);
    const o = await base44.entities.Official.list();
    setOfficials(o);
  };

  const del = async (id) => {
    if (!confirm("Delete this official?")) return;
    await base44.entities.Official.delete(id);
    const o = await base44.entities.Official.list();
    setOfficials(o);
  };

  const openEdit = (official) => {
    setEditing(official);
    setForm({ ...emptyForm, ...official, preferred_divisions: official.preferred_divisions || [] });
    setShowForm(true);
  };

  const toggleDiv = (divId) => {
    setForm(f => ({
      ...f,
      preferred_divisions: f.preferred_divisions.includes(divId)
        ? f.preferred_divisions.filter(d => d !== divId)
        : [...f.preferred_divisions, divId]
    }));
  };

  const filtered = officials.filter(o => filterRole === "all" || o.role === filterRole);
  const refs = officials.filter(o => o.role === "referee");
  const tks = officials.filter(o => o.role === "timekeeper");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Officials</h1>
          <p className="text-gray-400 text-sm mt-1">{refs.length} referees · {tks.length} timekeepers</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: SILVER }}>
          <Plus className="w-4 h-4" /> Add Official
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        {["all", "referee", "timekeeper"].map(r => (
          <button key={r} onClick={() => setFilterRole(r)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize border"
            style={filterRole === r
              ? { background: GOLD, color: "#000", borderColor: GOLD }
              : { background: "#111", color: "#999", borderColor: "#333" }}>
            {r === "all" ? "All" : r === "referee" ? `Referees (${refs.length})` : `Timekeepers (${tks.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-36 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(o => (
            <div key={o.id} className="rounded-xl border p-4 transition-colors hover:border-gray-600"
              style={{ background: "#111", borderColor: "#2a2a2a" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {o.role === "referee"
                    ? <RefStripes name={o.full_name} size={38} />
                    : <TKAvatar name={o.full_name} size={38} />}
                  <div>
                    <div className="font-semibold text-white text-sm">{o.full_name}</div>
                    <div className="text-xs capitalize" style={{ color: o.role === "referee" ? SILVER : GOLD }}>{o.role} · {o.certification_level}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(o)} className="p-1 text-gray-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(o.id)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {o.user_email && <div className="text-xs text-gray-500 mb-1">{o.user_email}</div>}
              {o.phone && <div className="text-xs text-gray-500 mb-2">{o.phone}</div>}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Max {o.max_games_per_week}/week</span>
                <span className={`px-2 py-0.5 rounded-full ${o.is_active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                  {o.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {o.preferred_divisions?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {o.preferred_divisions.map(divId => {
                    const d = divisions.find(x => x.id === divId);
                    return d ? <span key={divId} className="text-xs px-1.5 py-0.5 rounded border" style={{ borderColor: `${GOLD}40`, color: GOLD, background: `${GOLD}10` }}>{d.name}</span> : null;
                  })}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-500">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No officials found.</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "#111", borderColor: "#333" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editing ? "Edit Official" : "Add Official"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: "full_name", label: "Full Name *", type: "text" },
                { key: "user_email", label: "Login Email", type: "email" },
                { key: "phone", label: "Phone", type: "tel" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm text-gray-400 block mb-1">{f.label}</label>
                  <input type={f.type} className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                    style={{ borderColor: "#333" }}
                    value={form[f.key]} onChange={e => setForm(ff => ({ ...ff, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Role</label>
                  <select className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" style={{ borderColor: "#333" }}
                    value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="referee">Referee</option>
                    <option value="timekeeper">Timekeeper</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Certification Level</label>
                  <select className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" style={{ borderColor: "#333" }}
                    value={form.certification_level} onChange={e => setForm(f => ({ ...f, certification_level: e.target.value }))}>
                    {["level1","level2","level3","level4","level5"].map(l => <option key={l} value={l}>{l.replace("level","Level ")}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Max Games Per Week</label>
                <input type="number" className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" style={{ borderColor: "#333" }}
                  value={form.max_games_per_week} onChange={e => setForm(f => ({ ...f, max_games_per_week: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Preferred Divisions</label>
                <div className="flex flex-wrap gap-2">
                  {divisions.map(d => (
                    <button key={d.id} type="button" onClick={() => toggleDiv(d.id)}
                      className="px-3 py-1.5 rounded-lg text-sm transition-colors border"
                      style={form.preferred_divisions?.includes(d.id)
                        ? { background: GOLD, color: "#000", borderColor: GOLD }
                        : { background: "#1a1a1a", color: "#999", borderColor: "#333" }}>
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Notes</label>
                <textarea className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none h-16 resize-none" style={{ borderColor: "#333" }}
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: GOLD }} />
                <label htmlFor="active" className="text-sm text-gray-300">Active</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={save} className="flex-1 py-2 rounded-lg text-black text-sm font-medium" style={{ background: SILVER }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}