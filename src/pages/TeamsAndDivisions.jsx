import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users, X, Upload, Download } from "lucide-react";

export default function TeamsAndDivisions() {
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [showDivForm, setShowDivForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingDiv, setEditingDiv] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedDivId, setSelectedDivId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [divForm, setDivForm] = useState({ name: "", level: "", season: "2025-2026", games_per_team: 30 });
  const [teamForm, setTeamForm] = useState({ name: "", manager_name: "", manager_email: "", manager_phone: "", season: "2025-2026" });
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [d, t] = await Promise.all([base44.entities.Division.list(), base44.entities.Team.list()]);
    setDivisions(d);
    setTeams(t);
    setLoading(false);
  };

  const saveDiv = async () => {
    if (editingDiv) {
      await base44.entities.Division.update(editingDiv.id, divForm);
    } else {
      await base44.entities.Division.create(divForm);
    }
    setShowDivForm(false); setEditingDiv(null);
    setDivForm({ name: "", level: "", season: "2025-2026", games_per_team: 30 });
    loadAll();
  };

  const deleteDiv = async (id) => {
    if (!confirm("Delete this division and all its teams?")) return;
    await base44.entities.Division.delete(id);
    loadAll();
  };

  const saveTeam = async () => {
    const data = { ...teamForm, division_id: selectedDivId, division_name: divisions.find(d => d.id === selectedDivId)?.name };
    if (editingTeam) {
      await base44.entities.Team.update(editingTeam.id, data);
    } else {
      await base44.entities.Team.create(data);
    }
    setShowTeamForm(false); setEditingTeam(null);
    setTeamForm({ name: "", manager_name: "", manager_email: "", manager_phone: "", season: "2025-2026" });
    loadAll();
  };

  const deleteTeam = async (id) => {
    if (!confirm("Delete this team?")) return;
    await base44.entities.Team.delete(id);
    loadAll();
  };

  const openAddTeam = (divId) => {
    setSelectedDivId(divId);
    setEditingTeam(null);
    setTeamForm({ name: "", manager_name: "", manager_email: "", manager_phone: "", season: "2025-2026" });
    setShowTeamForm(true);
  };

  const openEditTeam = (team) => {
    setSelectedDivId(team.division_id);
    setEditingTeam(team);
    setTeamForm({ name: team.name, manager_name: team.manager_name || "", manager_email: team.manager_email || "", manager_phone: team.manager_phone || "", season: team.season || "2025-2026" });
    setShowTeamForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams & Divisions</h1>
          <p className="text-gray-400 text-sm mt-1">{divisions.length} divisions · {teams.length} teams</p>
        </div>
        <button onClick={() => { setEditingDiv(null); setDivForm({ name: "", level: "", season: "2025-2026", games_per_team: 30 }); setShowDivForm(true); }}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Division
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-16 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {divisions.map(div => {
            const divTeams = teams.filter(t => t.division_id === div.id);
            const isExpanded = expanded[div.id];
            return (
              <div key={div.id} className="bg-[#1e2533] rounded-xl border border-gray-800">
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(e => ({ ...e, [div.id]: !isExpanded }))}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div>
                      <span className="font-semibold text-white">{div.name}</span>
                      {div.level && <span className="ml-2 text-xs text-gray-400">{div.level}</span>}
                      <span className="ml-3 text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                        <Users className="w-3 h-3 inline mr-1" />{divTeams.length} teams
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openAddTeam(div.id)} className="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Team
                    </button>
                    <button onClick={() => { setEditingDiv(div); setDivForm({ name: div.name, level: div.level || "", season: div.season, games_per_team: div.games_per_team || 30 }); setShowDivForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-white transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => deleteDiv(div.id)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-700 p-4">
                    {divTeams.length === 0 ? (
                      <p className="text-gray-500 text-sm">No teams in this division yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {divTeams.map(team => (
                          <div key={team.id} className="bg-gray-900/50 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">{team.name}</div>
                              {team.manager_name && <div className="text-xs text-gray-400">{team.manager_name}</div>}
                              {team.manager_email && <div className="text-xs text-gray-500">{team.manager_email}</div>}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => openEditTeam(team)} className="p-1 text-gray-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteTeam(team.id)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {divisions.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No divisions yet. Add your first division above.</p>
            </div>
          )}
        </div>
      )}

      {/* Division Modal */}
      {showDivForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingDiv ? "Edit Division" : "Add Division"}</h2>
              <button onClick={() => setShowDivForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Division Name *</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={divForm.name} onChange={e => setDivForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Division AA" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Level Description</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={divForm.level} onChange={e => setDivForm(f => ({ ...f, level: e.target.value }))} placeholder="e.g. Elite, Competitive" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Season</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={divForm.season} onChange={e => setDivForm(f => ({ ...f, season: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Games Per Team</label>
                <input type="number" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={divForm.games_per_team} onChange={e => setDivForm(f => ({ ...f, games_per_team: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowDivForm(false)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-white/5">Cancel</button>
              <button onClick={saveDiv} className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingTeam ? "Edit Team" : "Add Team"}</h2>
              <button onClick={() => setShowTeamForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: "name", label: "Team Name *", placeholder: "e.g. Thunder Hawks" },
                { key: "manager_name", label: "Manager Name", placeholder: "" },
                { key: "manager_email", label: "Manager Email", placeholder: "" },
                { key: "manager_phone", label: "Manager Phone", placeholder: "" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm text-gray-400 block mb-1">{f.label}</label>
                  <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={teamForm[f.key]} onChange={e => setTeamForm(tf => ({ ...tf, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowTeamForm(false)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-white/5">Cancel</button>
              <button onClick={saveTeam} className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}