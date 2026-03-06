import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users, X, Upload, Download, CheckSquare, Square } from "lucide-react";

function ImportProgress({ total, current, done }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{done ? "Import complete!" : `Importing row ${current} of ${total}...`}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, done: false });
  const [importResult, setImportResult] = useState(null);

  // Selection for bulk delete (per division)
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const downloadTemplate = () => {
    const csv = "division_name,team_name,manager_name,manager_email,manager_phone,season\nDivision AA,Thunder Hawks,John Smith,john@email.com,555-1234,2025-2026\nDivision AA,Ice Wolves,Jane Doe,jane@email.com,555-5678,2025-2026";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "teams_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const text = await importFile.text();
    const lines = text.trim().split("\n").filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const dataLines = lines.slice(1);
    let created = 0, skipped = 0, errors = [];
    const currentDivs = [...divisions];

    setImportProgress({ current: 0, total: dataLines.length, done: false });

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(",").map(c => c.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });
      if (!row.team_name) { skipped++; continue; }
      try {
        let div = currentDivs.find(d => d.name.toLowerCase() === row.division_name?.toLowerCase());
        if (!div && row.division_name) {
          div = await base44.entities.Division.create({ name: row.division_name, season: row.season || "2025-2026", games_per_team: 30 });
          currentDivs.push(div);
        }
        await base44.entities.Team.create({
          name: row.team_name,
          division_id: div?.id || "",
          division_name: div?.name || row.division_name || "",
          manager_name: row.manager_name || "",
          manager_email: row.manager_email || "",
          manager_phone: row.manager_phone || "",
          season: row.season || "2025-2026",
        });
        created++;
      } catch (e) { errors.push(`Row ${i + 1}: ${e.message}`); }
      setImportProgress({ current: i + 1, total: dataLines.length, done: i + 1 === dataLines.length });
    }
    setImportResult({ created, skipped, errors });
    setImporting(false);
    loadAll();
  };

  const loadAll = async () => {
    setLoading(true);
    const [d, t] = await Promise.all([base44.entities.Division.list(), base44.entities.Team.list()]);
    setDivisions(d);
    setTeams(t);
    setSelectedTeamIds(new Set());
    setLoading(false);
  };

  const saveDiv = async () => {
    if (editingDiv) await base44.entities.Division.update(editingDiv.id, divForm);
    else await base44.entities.Division.create(divForm);
    setShowDivForm(false); setEditingDiv(null);
    setDivForm({ name: "", level: "", season: "2025-2026", games_per_team: 30 });
    loadAll();
  };

  const deleteDiv = async (id) => {
    if (!confirm("Delete this division and all its teams?")) return;
    const divTeams = teams.filter(t => t.division_id === id);
    for (const t of divTeams) await base44.entities.Team.delete(t.id);
    await base44.entities.Division.delete(id);
    loadAll();
  };

  const saveTeam = async () => {
    const data = { ...teamForm, division_id: selectedDivId, division_name: divisions.find(d => d.id === selectedDivId)?.name };
    if (editingTeam) await base44.entities.Team.update(editingTeam.id, data);
    else await base44.entities.Team.create(data);
    setShowTeamForm(false); setEditingTeam(null);
    setTeamForm({ name: "", manager_name: "", manager_email: "", manager_phone: "", season: "2025-2026" });
    loadAll();
  };

  const deleteTeam = async (id) => {
    if (!confirm("Delete this team?")) return;
    await base44.entities.Team.delete(id);
    loadAll();
  };

  const deleteSelectedTeams = async () => {
    if (selectedTeamIds.size === 0) return;
    if (!confirm(`Delete ${selectedTeamIds.size} selected team(s)?`)) return;
    setDeleting(true);
    for (const id of selectedTeamIds) await base44.entities.Team.delete(id);
    setDeleting(false);
    await loadAll();
  };

  const toggleTeam = (id) => setSelectedTeamIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const selectAllInDiv = (divTeams) => {
    const ids = divTeams.map(t => t.id);
    const allSelected = ids.every(id => selectedTeamIds.has(id));
    setSelectedTeamIds(prev => {
      const n = new Set(prev);
      if (allSelected) ids.forEach(id => n.delete(id));
      else ids.forEach(id => n.add(id));
      return n;
    });
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams & Divisions</h1>
          <p className="text-gray-400 text-sm mt-1">{divisions.length} divisions · {teams.length} teams</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {selectedTeamIds.size > 0 && (
            <button onClick={deleteSelectedTeams} disabled={deleting}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Delete {selectedTeamIds.size} teams
            </button>
          )}
          <button onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); setImportProgress({ current: 0, total: 0, done: false }); }}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => { setEditingDiv(null); setDivForm({ name: "", level: "", season: "2025-2026", games_per_team: 30 }); setShowDivForm(true); }}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Division
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-16 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {divisions.map(div => {
            const divTeams = teams.filter(t => t.division_id === div.id);
            const isExpanded = expanded[div.id];
            const allDivSelected = divTeams.length > 0 && divTeams.every(t => selectedTeamIds.has(t.id));
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
                      <span className="ml-2 text-xs text-gray-500">{div.season} · {div.games_per_team} games</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {isExpanded && divTeams.length > 0 && (
                      <button onClick={() => selectAllInDiv(divTeams)} className="text-xs text-gray-400 hover:text-sky-400 flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700 hover:border-sky-500">
                        {allDivSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />} Select all
                      </button>
                    )}
                    <button onClick={() => openAddTeam(div.id)} className="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Team
                    </button>
                    <button onClick={() => { setEditingDiv(div); setDivForm({ name: div.name, level: div.level || "", season: div.season, games_per_team: div.games_per_team || 30 }); setShowDivForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-white"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => deleteDiv(div.id)} className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-700 p-4">
                    {divTeams.length === 0 ? (
                      <p className="text-gray-500 text-sm">No teams in this division yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {divTeams.map(team => (
                          <div key={team.id}
                            className={`bg-gray-900/50 rounded-lg p-3 flex items-center justify-between border ${selectedTeamIds.has(team.id) ? "border-sky-500/40 bg-sky-500/5" : "border-transparent"}`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <button onClick={() => toggleTeam(team.id)} className="text-gray-500 hover:text-sky-400 shrink-0">
                                {selectedTeamIds.has(team.id) ? <CheckSquare className="w-4 h-4 text-sky-400" /> : <Square className="w-4 h-4" />}
                              </button>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">{team.name}</div>
                                {team.manager_name && <div className="text-xs text-gray-400 truncate">{team.manager_name}</div>}
                                {team.manager_email && <div className="text-xs text-gray-500 truncate">{team.manager_email}</div>}
                                {team.manager_phone && <div className="text-xs text-gray-500">{team.manager_phone}</div>}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
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

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Bulk Import Teams</h2>
              <button onClick={() => setShowImport(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3 mb-4 text-xs text-sky-300">
              Columns: <strong>division_name, team_name, manager_name, manager_email, manager_phone, season</strong><br />
              Divisions are created automatically if they don't exist.
            </div>
            <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 mb-4 underline">
              <Download className="w-4 h-4" /> Download template CSV
            </button>
            <div>
              <label className="text-sm text-gray-400 block mb-1">CSV File *</label>
              <input type="file" accept=".csv" className="w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-sky-500 file:text-white file:text-sm file:cursor-pointer cursor-pointer"
                onChange={e => setImportFile(e.target.files[0])} />
            </div>
            {importing && <ImportProgress total={importProgress.total} current={importProgress.current} done={importProgress.done} />}
            {importResult && !importing && (
              <div className={`mt-3 rounded-lg p-3 text-sm ${importResult.errors?.length ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300" : "bg-green-500/10 border border-green-500/20 text-green-300"}`}>
                ✓ {importResult.created} teams imported{importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ""}.
                {importResult.errors?.length > 0 && <div className="mt-1 text-xs opacity-80">{importResult.errors.slice(0, 3).join(" · ")}</div>}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowImport(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Close</button>
              <button onClick={handleImportCSV} disabled={!importFile || importing}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium">
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
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
              {[
                { key: "name", label: "Division Name *", placeholder: "e.g. Division AA" },
                { key: "level", label: "Level Description", placeholder: "e.g. Elite, Competitive" },
                { key: "season", label: "Season", placeholder: "2025-2026" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm text-gray-400 block mb-1">{f.label}</label>
                  <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={divForm[f.key]} onChange={e => setDivForm(ff => ({ ...ff, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Games Per Team</label>
                <input type="number" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={divForm.games_per_team} onChange={e => setDivForm(f => ({ ...f, games_per_team: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowDivForm(false)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm">Cancel</button>
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
              <button onClick={() => setShowTeamForm(false)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm">Cancel</button>
              <button onClick={saveTeam} className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}