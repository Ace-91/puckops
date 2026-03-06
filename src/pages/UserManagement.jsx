import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Shield, Clock, User, Mail, ChevronDown, Search, Pencil, Check, X, Plus } from "lucide-react";

const ROLES = ["admin", "referee_coordinator", "team_manager", "referee", "timekeeper"];

const ROLE_COLORS = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  referee_coordinator: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  team_manager: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  referee: "bg-green-500/10 text-green-400 border-green-500/20",
  timekeeper: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("team_manager");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    const u = await base44.entities.User.list();
    setUsers(u);
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

  const inviteUser = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviteResult({ success: true, msg: `Invitation sent to ${inviteEmail}` });
    setInviteEmail("");
    setInviting(false);
  };

  const filtered = users.filter(u =>
    (filterRole === "all" || u.role === filterRole) &&
    (!search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const roleCounts = ROLES.reduce((acc, r) => { acc[r] = users.filter(u => u.role === r).length; return acc; }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">{users.length} users registered</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Invite User
        </button>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {ROLES.map(r => (
          <div key={r} className={`rounded-xl p-3 border text-center cursor-pointer transition-colors ${filterRole === r ? "border-sky-500 bg-sky-500/10" : "bg-[#1e2533] border-gray-800 hover:border-gray-600"}`}
            onClick={() => setFilterRole(filterRole === r ? "all" : r)}>
            <div className="text-xl font-bold text-white">{roleCounts[r] || 0}</div>
            <div className="text-xs text-gray-400 mt-0.5 capitalize">{r.replace(/_/g, " ")}</div>
          </div>
        ))}
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="bg-[#1e2533] rounded-xl border border-sky-500/30 p-5 mb-5">
          <h3 className="font-semibold text-white mb-3">Invite New User</h3>
          <div className="flex flex-wrap gap-3">
            <input type="email" placeholder="Email address..."
              className="flex-1 min-w-48 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <select className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
            <button onClick={inviteUser} disabled={inviting || !inviteEmail}
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </div>
          {inviteResult && (
            <div className={`mt-3 text-sm rounded-lg px-3 py-2 ${inviteResult.success ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-300"}`}>
              {inviteResult.msg}
            </div>
          )}
          <div className="mt-3 text-xs text-gray-500">
            <span className="font-medium text-gray-400">Role permissions: </span>
            Admin = full access · Referee Coordinator = officials + schedule · Team Manager = blackouts + forfeits · Referee/Timekeeper = own schedule + trades
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="w-full bg-[#1e2533] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
            placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-16 animate-pulse" />)}</div>
      ) : (
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-sky-600 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0">
                        {u.full_name?.[0] || u.email?.[0] || "?"}
                      </div>
                      <span className="text-sm font-medium text-white">{u.full_name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <select autoFocus className="bg-gray-900 border border-sky-500 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                        value={editRole} onChange={e => setEditRole(e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {u.role?.replace(/_/g, " ") || "no role"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.created_date?.split("T")[0]}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === u.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => saveRole(u.id)} disabled={saving} className="p-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-green-400">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-700 rounded-lg text-gray-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(u.id); setEditRole(u.role || "team_manager"); }}
                        className="p-1.5 text-gray-500 hover:text-sky-400 transition-colors rounded-lg hover:bg-sky-500/10">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-10 text-gray-500">No users found.</p>}
        </div>
      )}
    </div>
  );
}