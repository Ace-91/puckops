import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users, X, Upload, Download, CheckSquare, Square, ArrowUpDown, List, LayoutGrid, MoveRight, FileDown } from "lucide-react";
import ProgressModal from "@/components/ProgressModal";
import { batchDelete, batchUpdate, bulkCreateInChunks } from "@/components/batchOps";

function ImportProgress({ total, current, done }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{done ? "Import complete!" : `Importing row ${current} of ${total}...`}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#c0c0c0,#d4af37)" }} />
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
  const [viewMode, setViewMode] = useState("divisions"); // "divisions" | "list"

  const [divForm, setDivForm] = useState({ name: "", level: "", season: "2025-2026", games_per_team: 30 });
  const [teamForm, setTeamForm] = useState({ name: "", manager_name: "", manager_email: "", manager_phone: "", season: "2025-2026" });

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, done: false });
  const [importResult, setImportResult] = useState(null);

  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());
  const [progress, setProgress] = useState(null);

  // List view sort
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // Move division modal
  const [movingTeam, setMovingTeam] = useState(null);
  const [moveTargetDivId, setMoveTargetDivId] = useState("");

  useEffect(() => { loadAll(); }, []);

  const exportTeamsCSV = () => {
    const rows = [["division_name", "team_name", "manager_name", "manager_email", "manager_phone", "season"]];
    teams.forEach(t => rows.push([t.division_name || "", t.name, t.manager_name || "", t.manager_email || "", t.manager_phone || "", t.season || ""]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "teams_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportDivisionsCSV = () => {
    const rows = [["division_name", "level", "season", "games_per_team", "team_count"]];
    divisions.forEach(d => {
      const count = teams.filter(t => t.division_id === d.id).length;
      rows.push([d.name, d.level || "", d.season || "", d.games_per_team || 30, count]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "divisions_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCombinedCSV = () => {
    const rows = [["division_name", "division_level", "games_per_team", "team_name", "manager_name", "manager_email", "manager_phone", "season"]];
    divisions.forEach(d => {
      const divTeams = teams.filter(t => t.division_id === d.id);
      if (divTeams.length === 0) {
        rows.push([d.name, d.level || "", d.games_per_team || 30, "", "", "", "", d.season || ""]);
      } else {
        divTeams.forEach(t => rows.push([d.name, d.level || "", d.games_per_team || 30, t.name, t.manager_name || "", t.manager_email || "", t.manager_phone || "", t.season || ""]));
      }
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "divisions_and_teams_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

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
    let skipped = 0;
    const currentDivs = [...divisions];
    const currentTeams = [...teams];

    // Parse rows and ensure divisions exist first
    const toCreate = [], toUpdate = [];
    for (const line of dataLines) {
      const cols = line.split(",").map(c => c.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });
      if (!row.team_name) { skipped++; continue; }
      let div = currentDivs.find(d => d.name.toLowerCase() === row.division_name?.toLowerCase());
      if (!div && row.division_name) {
        div = await base44.entities.Division.create({ name: row.division_name, season: row.season || "2025-2026", games_per_team: 30 });
        currentDivs.push(div);
      }
      const teamData = {
        name: row.team_name,
        division_id: div?.id || "",
        division_name: div?.name || row.division_name || "",
        manager_name: row.manager_name || "",
        manager_email: row.manager_email || "",
        manager_phone: row.manager_phone || "",
        season: row.season || "2025-2026",
      };
      const existing = currentTeams.find(t =>
        t.name.toLowerCase() === row.team_name.toLowerCase() &&
        (t.division_id === div?.id || t.division_name?.toLowerCase() === row.division_name?.toLowerCase())
      );
      if (existing) toUpdate.push({ id: existing.id, data: teamData });
      else toCreate.push(teamData);
    }

    const total = toCreate.length + toUpdate.length;
    setImportProgress({ current: 0, total, done: false });

    // Bulk-create new teams one-by-one for smooth progress
    let doneCount = 0;
    const CHUNK_SIZE = 5;
    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CHUNK_SIZE);
      await base44.entities.Team.bulkCreate(chunk);
      doneCount += chunk.length;
      setImportProgress({ current: doneCount, total, done: false });
      await new Promise(r => setTimeout(r, 300));
    }

    // Batch-update existing teams with smooth progress
    for (let i = 0; i < toUpdate.length; i++) {
      await base44.entities.Team.update(toUpdate[i].id, toUpdate[i].data);
      doneCount++;
      setImportProgress({ current: doneCount, total, done: false });
    }

    setImportProgress({ current: total, total, done: true });
    setImportResult({ created: toCreate.length, updated: toUpdate.length, skipped, errors: [] });
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
    if (!confirm("Delete this division? Teams will be disassociated (not deleted).")) return;
    const divTeams = teams.filter(t => t.division_id === id);
    for (const t of divTeams) await base44.entities.Team.update(t.id, { division_id: "", division_name: "" });
    await base44.entities.Division.delete(id);
    loadAll();
  };

  const saveTeam = async () => {
    const div = divisions.find(d => d.id === selectedDivId);
    const data = { ...teamForm, division_id: selectedDivId || "", division_name: div?.name || "" };
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
    if (!confirm(`Permanently delete ${selectedTeamIds.size} team(s)?`)) return;
    const ids = [...selectedTeamIds];
    setProgress({ title: "Deleting Teams", current: 0, total: ids.length });
    await batchDelete(
      ids,
      id => base44.entities.Team.delete(id),
      (current, total) => setProgress({ title: "Deleting Teams", current, total })
    );
    setProgress(null);
    await loadAll();
  };

  const moveSelectedTeams = async (targetDivId) => {
    const div = divisions.find(d => d.id === targetDivId);
    if (!div) return;
    const ids = [...selectedTeamIds];
    setProgress({ title: "Moving Teams", current: 0, total: ids.length });
    await batchUpdate(
      ids,
      id => base44.entities.Team.update(id, { division_id: div.id, division_name: div.name }),
      (current, total) => setProgress({ title: "Moving Teams", current, total })
    );
    setProgress(null);
    await loadAll();
  };

  const moveTeam = async () => {
    if (!movingTeam || !moveTargetDivId) return;
    const div = divisions.find(d => d.id === moveTargetDivId);
    await base44.entities.Team.update(movingTeam.id, { division_id: div.id, division_name: div.name });
    setMovingTeam(null);
    setMoveTargetDivId("");
    loadAll();
  };

  const toggleTeam = (id) => setSelectedTeamIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const selectAllInDiv = (divTeams) => {
    const ids = divTeams.map(t => t.id);
    const allSelected = ids.every(id => selectedTeamIds.has(id));
    setSelectedTeamIds(prev => {
      const n = new Set(prev);
      if (allSelected) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id));
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
    setSelectedDivId(team.division_id || "");
    setEditingTeam(team);
    setTeamForm({ name: team.name, manager_name: team.manager_name || "", manager_email: team.manager_email || "", manager_phone: team.manager_phone || "", season: team.season || "2025-2026" });
    setShowTeamForm(true);
  };

  // Sorted team list
  const sortedTeams = [...teams].sort((a, b) => {
    let av = a[sortKey] || "", bv = b[sortKey] || "";
    if (sortKey === "division_name") { av = a.division_name || ""; bv = b.division_name || ""; }
    const cmp = av.toString().localeCompare(bv.toString());
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortHeader = ({ k, label }) => (
    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-white select-none"
      onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{label}<ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-yellow-400" : "text-gray-700"}`} /></span>
    </th>
  );

  // Move division dropdown (for bulk)
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);

  return (
    <div>
      {progress && <ProgressModal title={progress.title} current={progress.current} total={progress.total} />}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams & Divisions</h1>
          <p className="text-gray-400 text-sm mt-1">{divisions.length} divisions · {teams.length} teams</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Bulk actions when teams selected */}
          {selectedTeamIds.size > 0 && (
            <div className="flex gap-2 items-center">
              <div className="relative">
                <button onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: "#d4af37", color: "#d4af37" }}>
                  <MoveRight className="w-4 h-4" /> Move {selectedTeamIds.size} to...
                </button>
                {showMoveDropdown && (
                  <div className="absolute top-full left-0 mt-1 rounded-lg border border-gray-800 shadow-xl z-20 py-1 min-w-48" style={{ background: "#111" }}>
                    {divisions.map(d => (
                      <button key={d.id} onClick={() => { moveSelectedTeams(d.id); setShowMoveDropdown(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={deleteSelectedTeams}
                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm font-medium">
                <Trash2 className="w-4 h-4" /> Delete {selectedTeamIds.size}
              </button>
            </div>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-800">
            <button onClick={() => setViewMode("divisions")} className="px-3 py-2 text-sm font-medium transition-colors text-black"
              style={{ background: viewMode === "divisions" ? "#c0c0c0" : "#111", color: viewMode === "divisions" ? "#000" : "#999" }}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("list")} className="px-3 py-2 text-sm font-medium transition-colors"
              style={{ background: viewMode === "list" ? "#c0c0c0" : "#111", color: viewMode === "list" ? "#000" : "#999" }}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={exportCombinedCSV} disabled={divisions.length === 0 && teams.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-40" style={{ background: "#c0c0c0" }}>
            <FileDown className="w-4 h-4" /> Export All
          </button>
          <button onClick={exportDivisionsCSV} disabled={divisions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-40" style={{ background: "#c0c0c0" }}>
            <FileDown className="w-4 h-4" /> Divisions
          </button>
          <button onClick={exportTeamsCSV} disabled={teams.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-40" style={{ background: "#c0c0c0" }}>
            <FileDown className="w-4 h-4" /> Teams
          </button>
          <button onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); setImportProgress({ current: 0, total: 0, done: false }); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#c0c0c0" }}>
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => { setEditingDiv(null); setDivForm({ name: "", level: "", season: "2025-2026", games_per_team: 30 }); setShowDivForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#d4af37" }}>
            <Plus className="w-4 h-4" /> Add Division
          </button>
        </div>
      </div>

      {/* Warning: teams missing a division */}
      {!loading && teams.some(t => !t.division_id) && (
        <div className="mb-4 rounded-xl p-4 border flex items-start gap-3" style={{ background: "#1a1000", borderColor: "#d4af3740" }}>
          <span className="text-yellow-400 text-lg shrink-0">⚠</span>
          <div>
            <div className="text-sm font-semibold text-yellow-400">Teams missing a division</div>
            <div className="text-xs text-yellow-300/70 mt-1">
              {teams.filter(t => !t.division_id).map(t => t.name).join(", ")} — edit each to assign a division.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: "#111" }} />)}</div>
      ) : viewMode === "list" ? (
        /* ── SORTABLE LIST VIEW ── */
        <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#0d0d0d" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800" style={{ background: "#111" }}>
                <th className="px-4 py-3 w-10">
                  <button onClick={() => {
                    if (selectedTeamIds.size === teams.length) setSelectedTeamIds(new Set());
                    else setSelectedTeamIds(new Set(teams.map(t => t.id)));
                  }} className="text-gray-600 hover:text-yellow-400">
                    {selectedTeamIds.size === teams.length && teams.length > 0
                      ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <SortHeader k="name" label="Team" />
                <SortHeader k="division_name" label="Division" />
                <SortHeader k="manager_name" label="Manager" />
                <SortHeader k="manager_email" label="Email" />
                <SortHeader k="manager_phone" label="Phone" />
                <SortHeader k="season" label="Season" />
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {sortedTeams.map(team => (
                <tr key={team.id} className={`transition-colors ${selectedTeamIds.has(team.id) ? "bg-yellow-500/5" : "hover:bg-white/2"}`}>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleTeam(team.id)} className="text-gray-600 hover:text-yellow-400">
                      {selectedTeamIds.has(team.id) ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-white">{team.name}</td>
                  <td className="px-4 py-2.5 text-sm">
                    {team.division_name
                      ? <span className="px-2 py-0.5 rounded-full text-xs border" style={{ borderColor: "#d4af3740", color: "#d4af37" }}>{team.division_name}</span>
                      : <span className="text-xs text-yellow-600">⚠ Unassigned</span>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-400">{team.manager_name || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-500">{team.manager_email || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-500">{team.manager_phone || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{team.season || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setMovingTeam(team); setMoveTargetDivId(""); }} className="p-1.5 text-gray-600 hover:text-yellow-400 rounded" title="Move division"><MoveRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEditTeam(team)} className="p-1.5 text-gray-600 hover:text-white rounded"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteTeam(team.id)} className="p-1.5 text-gray-600 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-600">No teams yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── DIVISIONS VIEW ── */
        <div className="space-y-4">
          {teams.some(t => !t.division_id) && (
            <div className="rounded-xl border" style={{ background: "#111", borderColor: "#d4af3730" }}>
              <div className="flex items-center gap-2 p-4">
                <span className="text-yellow-400">⚠</span>
                <span className="font-semibold text-yellow-400">Unassigned Teams ({teams.filter(t => !t.division_id).length})</span>
              </div>
              <div className="border-t p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" style={{ borderColor: "#222" }}>
                {teams.filter(t => !t.division_id).map(team => (
                  <div key={team.id} className="rounded-lg p-3 flex items-center justify-between border" style={{ background: "#1a1000", borderColor: "#d4af3720" }}>
                    <div>
                      <div className="text-sm font-medium text-white">{team.name}</div>
                      <div className="text-xs text-yellow-600">No division assigned</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setMovingTeam(team); setMoveTargetDivId(""); }} className="p-1 text-gray-500 hover:text-yellow-400"><MoveRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEditTeam(team)} className="p-1 text-gray-500 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteTeam(team.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {divisions.map(div => {
            const divTeams = teams.filter(t => t.division_id === div.id);
            const isExpanded = expanded[div.id];
            const allDivSelected = divTeams.length > 0 && divTeams.every(t => selectedTeamIds.has(t.id));
            return (
              <div key={div.id} className="rounded-xl border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(e => ({ ...e, [div.id]: !isExpanded }))}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <div>
                      <span className="font-semibold text-white">{div.name}</span>
                      {div.level && <span className="ml-2 text-xs text-gray-500">{div.level}</span>}
                      <span className="ml-3 text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: "#d4af3730", color: "#d4af37" }}>
                        {divTeams.length} teams
                      </span>
                      <span className="ml-2 text-xs text-gray-600">{div.season} · {div.games_per_team} games/team</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {isExpanded && divTeams.length > 0 && (
                      <button onClick={() => selectAllInDiv(divTeams)} className="text-xs text-gray-500 hover:text-yellow-400 flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-800 hover:border-yellow-500">
                        {allDivSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />} Select all
                      </button>
                    )}
                    <button onClick={() => openAddTeam(div.id)} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 border border-gray-700 text-gray-400 hover:text-white">
                      <Plus className="w-3 h-3" /> Add Team
                    </button>
                    <button onClick={() => { setEditingDiv(div); setDivForm({ name: div.name, level: div.level || "", season: div.season, games_per_team: div.games_per_team || 30 }); setShowDivForm(true); }}
                      className="p-1.5 text-gray-500 hover:text-white"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => deleteDiv(div.id)} className="p-1.5 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4">
                    {divTeams.length === 0 ? (
                      <p className="text-gray-600 text-sm">No teams in this division yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {divTeams.map(team => (
                          <div key={team.id}
                            className={`rounded-lg p-3 flex items-center justify-between border transition-colors ${selectedTeamIds.has(team.id) ? "border-yellow-500/30 bg-yellow-500/5" : "border-gray-800 bg-black/20"}`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <button onClick={() => toggleTeam(team.id)} className="text-gray-600 hover:text-yellow-400 shrink-0">
                                {selectedTeamIds.has(team.id) ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} /> : <Square className="w-4 h-4" />}
                              </button>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">{team.name}</div>
                                {team.manager_name && <div className="text-xs text-gray-400 truncate">{team.manager_name}</div>}
                                {team.manager_email && <div className="text-xs text-gray-600 truncate">{team.manager_email}</div>}
                                {team.manager_phone && <div className="text-xs text-gray-600">{team.manager_phone}</div>}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button onClick={() => { setMovingTeam(team); setMoveTargetDivId(""); }} className="p-1 text-gray-600 hover:text-yellow-400" title="Move to division"><MoveRight className="w-3.5 h-3.5" /></button>
                              <button onClick={() => openEditTeam(team)} className="p-1 text-gray-600 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteTeam(team.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
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
          {divisions.length === 0 && teams.filter(t => !t.division_id).length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No divisions yet. Add your first division above.</p>
            </div>
          )}
        </div>
      )}

      {/* Move Team Modal */}
      {movingTeam && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-sm" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Move Team</h2>
              <button onClick={() => setMovingTeam(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Moving: <strong className="text-white">{movingTeam.name}</strong></p>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Target Division</label>
              <select className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                value={moveTargetDivId} onChange={e => setMoveTargetDivId(e.target.value)}>
                <option value="">Select division...</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setMovingTeam(null)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={moveTeam} disabled={!moveTargetDivId}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: "#d4af37" }}>
                Move Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-lg" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Bulk Import Teams</h2>
              <button onClick={() => setShowImport(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="rounded-lg p-3 mb-4 text-xs border" style={{ background: "#0a0a00", borderColor: "#d4af3730", color: "#d4af37" }}>
              Columns: <strong>division_name, team_name, manager_name, manager_email, manager_phone, season</strong><br />
              Divisions are created automatically if they don't exist.
            </div>
            <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm mb-4 underline" style={{ color: "#c0c0c0" }}>
              <Download className="w-4 h-4" /> Download template CSV
            </button>
            <div>
              <label className="text-sm text-gray-400 block mb-1">CSV File *</label>
              <input type="file" accept=".csv" className="w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-black file:text-sm file:cursor-pointer cursor-pointer"
                onChange={e => setImportFile(e.target.files[0])} />
            </div>
            {importing && <ImportProgress total={importProgress.total} current={importProgress.current} done={importProgress.done} />}
            {importResult && !importing && (
              <div className={`mt-3 rounded-lg p-3 text-sm border ${importResult.errors?.length ? "border-yellow-500/20 text-yellow-300" : "border-green-500/20 text-green-300"}`}
                style={{ background: importResult.errors?.length ? "#1a1000" : "#001a00" }}>
                ✓ {importResult.created} created{importResult.updated > 0 ? `, ${importResult.updated} updated` : ""}{importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ""}.
                {importResult.errors?.length > 0 && <div className="mt-1 text-xs opacity-80">{importResult.errors.slice(0, 3).join(" · ")}</div>}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowImport(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Close</button>
              <button onClick={handleImportCSV} disabled={!importFile || importing}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: "#c0c0c0" }}>
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Division Modal */}
      {showDivForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-md" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingDiv ? "Edit Division" : "Add Division"}</h2>
              <button onClick={() => setShowDivForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: "name", label: "Division Name *", placeholder: "e.g. Division AA" },
                { key: "level", label: "Level Description", placeholder: "e.g. Elite, Competitive" },
                { key: "season", label: "Season", placeholder: "2025-2026" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm text-gray-400 block mb-1">{f.label}</label>
                  <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                    value={divForm[f.key]} onChange={e => setDivForm(ff => ({ ...ff, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Games Per Team</label>
                <input type="number" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  value={divForm.games_per_team} onChange={e => setDivForm(f => ({ ...f, games_per_team: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowDivForm(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">Cancel</button>
              <button onClick={saveDiv} className="flex-1 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#d4af37" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-md" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingTeam ? "Edit Team" : "Add Team"}</h2>
              <button onClick={() => setShowTeamForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Division</label>
                <select className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  value={selectedDivId || ""} onChange={e => setSelectedDivId(e.target.value)}>
                  <option value="">No division</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {[
                { key: "name", label: "Team Name *", placeholder: "e.g. Thunder Hawks" },
                { key: "manager_name", label: "Manager Name", placeholder: "" },
                { key: "manager_email", label: "Manager Email", placeholder: "" },
                { key: "manager_phone", label: "Manager Phone", placeholder: "" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm text-gray-400 block mb-1">{f.label}</label>
                  <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                    value={teamForm[f.key]} onChange={e => setTeamForm(tf => ({ ...tf, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowTeamForm(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">Cancel</button>
              <button onClick={saveTeam} className="flex-1 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#c0c0c0" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}