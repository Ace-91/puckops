import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Shield, Search, Pencil, Check, X, Plus, Phone, Mail, Star, KeyRound, ExternalLink } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const ROLES = ["admin", "referee_coordinator", "team_manager", "referee", "timekeeper"];

const ROLE_COLORS = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  referee_coordinator: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  team_manager: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  referee: "bg-green-500/10 text-green-400 border-green-500/20",
  timekeeper: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const CERT_COLORS = {
  level1: "text-gray-400", level2: "text-blue-400", level3: "text-green-400",
  level4: "text-yellow-400", level5: "text-orange-400",
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [activeTab, setActiveTab] = useState("users"); // "users" | "officials"
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("team_manager");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [resetSent, setResetSent] = useState({}); // { [userId]: "sending" | "sent" | "error" }

  const [divisions, setDivisions] = useState([]);

  const load = async () => {
    setLoading(true);
    const [u, o, d] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Official.list(),
      base44.entities.Division.list(),
    ]);
    setUsers(u);
    setOfficials(o);
    setDivisions(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveRole = async (userId) => {
    setSaving(true);
    await base44.entities.User.update(userId, { role: editRole });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: editRole } : u));
    setEditingId(null);
    setSaving(false);
  };

  const sendPasswordReset = async (userId, email) => {
    setResetSent(prev => ({ ...prev, [userId]: "sending" }));
    await base44.auth.resetPasswordRequest(email);
    setResetSent(prev => ({ ...prev, [userId]: "sent" }));
    setTimeout(() => setResetSent(prev => ({ ...prev, [userId]: null })), 4000);
  };

  const inviteUser = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviteResult({ success: true, msg: `Invitation sent to ${inviteEmail}` });
    setInviteEmail("");
    setInviting(false);
  };

  const filteredUsers = users.filter(u =>
    (filterRole === "all" || u.role === filterRole) &&
    (!search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredOfficials = officials.filter(o =>
    (!search ||
      o.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.user_email?.toLowerCase().includes(search.toLowerCase())) &&
    (filterRole === "all" || o.role === filterRole)
  );

  const roleCounts = ROLES.reduce((acc, r) => { acc[r] = users.filter(u => u.role === r).length; return acc; }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">{users.length} registered users · {officials.length} officials</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black"
          style={{ background: "#c0c0c0" }}>
          <Plus className="w-4 h-4" /> Invite User
        </button>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        <div className={`rounded-xl p-3 border text-center cursor-pointer transition-colors ${filterRole === "all" ? "border-white/20 bg-white/5" : "border-gray-800 hover:border-gray-600"}`} style={{ background: filterRole === "all" ? "#1a1a1a" : "#0d0d0d" }}
          onClick={() => setFilterRole("all")}>
          <div className="text-xl font-bold text-white">{users.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">All Users</div>
        </div>
        {ROLES.map(r => (
          <div key={r} className={`rounded-xl p-3 border text-center cursor-pointer transition-colors ${filterRole === r ? "border-yellow-500/40 bg-yellow-500/5" : "border-gray-800 hover:border-gray-600"}`} style={{ background: filterRole === r ? undefined : "#0d0d0d" }}
            onClick={() => setFilterRole(filterRole === r ? "all" : r)}>
            <div className="text-xl font-bold text-white">{roleCounts[r] || 0}</div>
            <div className="text-xs text-gray-400 mt-0.5 capitalize">{r.replace(/_/g, " ")}</div>
          </div>
        ))}
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="rounded-xl border p-5 mb-5" style={{ background: "#0d0d0d", borderColor: "rgba(192,192,192,0.2)" }}>
          <h3 className="font-semibold text-white mb-3">Invite New User</h3>
          <div className="flex flex-wrap gap-3">
            <input type="email" placeholder="Email address..."
              className="flex-1 min-w-48 bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <select className="bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
            <button onClick={inviteUser} disabled={inviting || !inviteEmail}
              className="px-4 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: "#c0c0c0" }}>
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </div>
          {inviteResult && (
            <div className="mt-3 text-sm rounded-lg px-3 py-2 border border-green-500/20 text-green-300" style={{ background: "#001a00" }}>
              {inviteResult.msg}
            </div>
          )}
          <div className="mt-3 text-xs text-gray-500">
            Admin = full access · Referee Coordinator = officials + schedule · Team Manager = blackouts + forfeits · Referee/Timekeeper = own schedule + trades
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 rounded-lg p-1 w-fit" style={{ background: "#111" }}>
        <button onClick={() => setActiveTab("users")} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: activeTab === "users" ? "#c0c0c0" : "transparent", color: activeTab === "users" ? "#000" : "#999" }}>
          <Users className="w-4 h-4 inline mr-1.5" />System Users ({users.length})
        </button>
        <button onClick={() => setActiveTab("officials")} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: activeTab === "officials" ? "#c0c0c0" : "transparent", color: activeTab === "officials" ? "#000" : "#999" }}>
          <Shield className="w-4 h-4 inline mr-1.5" />Officials & Timekeepers ({officials.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="w-full border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-gray-600" style={{ background: "#111" }}
            placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {activeTab === "users" && (
          <select className="border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" style={{ background: "#111" }}
            value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="all">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        )}
        {activeTab === "officials" && (
          <select className="border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" style={{ background: "#111" }}
            value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="all">All Types</option>
            <option value="referee">Referees</option>
            <option value="timekeeper">Timekeepers</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: "#111" }} />)}</div>
      ) : activeTab === "users" ? (
        <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#0d0d0d" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800" style={{ background: "#111" }}>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Official Profile</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
                        style={{ background: "linear-gradient(135deg,#c0c0c0,#d4af37)" }}>
                        {u.full_name?.[0] || u.email?.[0] || "?"}
                      </div>
                      <span className="text-sm font-medium text-white">{u.full_name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <select autoFocus className="bg-black border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                        value={editRole} onChange={e => setEditRole(e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {u.role?.replace(/_/g, " ") || "no role"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                   {(() => {
                     const official = officials.find(o => o.user_email?.toLowerCase() === u.email?.toLowerCase());
                     if (!official) return <span className="text-xs text-gray-600">—</span>;
                     return (
                       <div className="flex items-center gap-1.5">
                         <span className={`text-xs px-2 py-0.5 rounded-full border ${official.role === "referee" ? "border-green-500/20 text-green-400 bg-green-500/5" : "border-orange-500/20 text-orange-400 bg-orange-500/5"}`}>
                           {official.role === "referee" ? "Referee" : "Timekeeper"}
                         </span>
                         {official.certification_level && (
                           <span className="text-xs text-gray-500">{official.certification_level.toUpperCase()}</span>
                         )}
                       </div>
                     );
                   })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{u.created_date?.split("T")[0]}</td>
                  <td className="px-4 py-3 text-right">
                   {editingId === u.id ? (
                     <div className="flex gap-1 justify-end">
                       <button onClick={() => saveRole(u.id)} disabled={saving} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10">
                         <Check className="w-3.5 h-3.5" />
                       </button>
                       <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700">
                         <X className="w-3.5 h-3.5" />
                       </button>
                     </div>
                   ) : (
                     <div className="flex gap-1 justify-end items-center">
                       <button
                         onClick={() => sendPasswordReset(u.id, u.email)}
                         disabled={resetSent[u.id] === "sending"}
                         title="Send password reset email"
                         className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${resetSent[u.id] === "sent" ? "text-green-400" : "text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10"}`}>
                         <KeyRound className="w-3.5 h-3.5" />
                         {resetSent[u.id] === "sending" ? "…" : resetSent[u.id] === "sent" ? "Sent!" : "Reset"}
                       </button>
                       <button onClick={() => { setEditingId(u.id); setEditRole(u.role || "team_manager"); }}
                         className="p-1.5 text-gray-600 hover:text-white rounded-lg hover:bg-white/5">
                         <Pencil className="w-3.5 h-3.5" />
                       </button>
                     </div>
                   )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && <p className="text-center py-10 text-gray-600">No users found.</p>}
        </div>
      ) : (
        /* Officials tab */
        <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#0d0d0d" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800" style={{ background: "#111" }}>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Certification</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Max Games/Wk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {filteredOfficials.map(o => (
                <tr key={o.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: o.role === "referee" ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)", color: o.role === "referee" ? "#4ade80" : "#fb923c" }}>
                        {o.full_name?.[0] || "?"}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{o.full_name}</div>
                        {o.user_email && <div className="text-xs text-gray-600">{o.user_email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${o.role === "referee" ? "border-green-500/20 text-green-400 bg-green-500/5" : "border-orange-500/20 text-orange-400 bg-orange-500/5"}`}>
                      {o.role === "referee" ? "Referee" : "Timekeeper"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.certification_level && (
                      <span className={`text-xs font-medium flex items-center gap-1 ${CERT_COLORS[o.certification_level]}`}>
                        <Star className="w-3 h-3" />{o.certification_level?.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {o.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{o.phone}</div>}
                    {o.user_email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{o.user_email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${o.is_active !== false ? "border-green-500/20 text-green-400" : "border-gray-700 text-gray-500"}`}>
                      {o.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 text-center">{o.max_games_per_week || 5}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOfficials.length === 0 && <p className="text-center py-10 text-gray-600">No officials found. Add them in the Officials page.</p>}
        </div>
      )}
    </div>
  );
}