import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, MapPin, X, Moon, Upload, Download, CheckSquare, Square, RefreshCw, Clock, FileDown } from "lucide-react";
import ProgressModal from "@/components/ProgressModal";
import IceSlotCalculator from "@/components/IceSlotCalculator";

function addOneHour(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const isLate = (time) => {
  if (!time) return false;
  const [h] = time.split(":").map(Number);
  return h >= 22;
};

export default function IceSlots() {
  const [arenas, setArenas] = useState([]);
  const [slots, setSlots] = useState([]);
  const [games, setGames] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArenaForm, setShowArenaForm] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [filterArena, setFilterArena] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [arenaForm, setArenaForm] = useState({ name: "", address: "" });
  const [slotForm, setSlotForm] = useState({ arena_id: "", date: "", start_time: "", season: "2025-2026" });

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkForm, setBulkForm] = useState({ arena_id: "", start_date: "", end_date: "", days_of_week: [], start_time: "", season: "2025-2026" });

  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ current: 0, total: 0 });
  const [csvResult, setCsvResult] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [progress, setProgress] = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [a, s, g, d, t] = await Promise.all([
      base44.entities.Arena.list(),
      base44.entities.IceSlot.list("date", 5000),
      base44.entities.Game.list("date", 2000),
      base44.entities.Division.list(),
      base44.entities.Team.list(),
    ]);
    setArenas(a);
    setSlots(s);
    setGames(g);
    setDivisions(d);
    setTeams(t);
    setSelectedIds(new Set());
    setLoading(false);
  };

  const exportSlotsCSV = () => {
    const rows = [["arena_name", "date", "start_time", "end_time", "season", "is_available", "is_late_game"]];
    slots.forEach(s => rows.push([s.arena_name, s.date, s.start_time, s.end_time || "", s.season || "", s.is_available ? "yes" : "no", s.is_late_game ? "yes" : "no"]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "iceslots_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSlotsTemplate = () => {
    const csv = "arena_name,date,start_time,season\nArena 1,2025-10-01,19:00,2025-2026\nArena 1,2025-10-03,22:00,2025-2026";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "iceslots_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const [csvConfirmPending, setCsvConfirmPending] = useState(false);

  // CSV Import — delete all existing slots first, then fast bulk-create
  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvConfirmPending(true);
  };

  const confirmAndImport = async () => {
    setCsvConfirmPending(false);
    setCsvImporting(true);
    setCsvResult(null);

    const text = await csvFile.text();
    const lines = text.trim().split("\n").filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const dataLines = lines.slice(1);

    let skipped = 0;
    const toCreate = [];

    for (const line of dataLines) {
      const cols = line.split(",").map(c => c.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });
      if (!row.date || !row.start_time) { skipped++; continue; }
      const arena = arenas.find(a => a.name.toLowerCase() === row.arena_name?.toLowerCase());
      toCreate.push({
        arena_id: arena?.id || "",
        arena_name: arena?.name || row.arena_name || "",
        date: row.date,
        start_time: row.start_time,
        end_time: addOneHour(row.start_time),
        season: row.season || "2025-2026",
        is_late_game: isLate(row.start_time),
        is_available: true,
      });
    }

    // Step 1: delete all existing slots
    const existingSlots = await base44.entities.IceSlot.list("date", 9999);
    setCsvProgress({ current: 0, total: existingSlots.length + toCreate.length, phase: "Deleting old slots" });
    for (let i = 0; i < existingSlots.length; i += 20) {
      await Promise.all(existingSlots.slice(i, i + 20).map(s => base44.entities.IceSlot.delete(s.id)));
      setCsvProgress({ current: i + 20, total: existingSlots.length + toCreate.length, phase: "Deleting old slots" });
      await new Promise(r => setTimeout(r, 500));
    }

    // Step 2: bulk-create new slots
    const BULK_SIZE = 50;
    let created = 0;
    for (let i = 0; i < toCreate.length; i += BULK_SIZE) {
      await base44.entities.IceSlot.bulkCreate(toCreate.slice(i, i + BULK_SIZE));
      created += Math.min(BULK_SIZE, toCreate.length - i);
      setCsvProgress({ current: existingSlots.length + created, total: existingSlots.length + toCreate.length, phase: "Importing slots" });
      await new Promise(r => setTimeout(r, 800));
    }

    setCsvResult({ created, skipped });
    setCsvImporting(false);
    loadAll();
  };

  const saveArena = async () => {
    await base44.entities.Arena.create(arenaForm);
    setShowArenaForm(false);
    setArenaForm({ name: "", address: "" });
    loadAll();
  };

  const deleteArena = async (id) => {
    if (!confirm("Delete this arena? This will not delete associated ice slots.")) return;
    await base44.entities.Arena.delete(id);
    loadAll();
  };

  const saveSlot = async () => {
    const arena = arenas.find(a => a.id === slotForm.arena_id);
    // Check duplicate
    const existing = slots.find(s =>
      s.arena_id === slotForm.arena_id &&
      s.date === slotForm.date &&
      s.start_time === slotForm.start_time
    );
    const data = {
      ...slotForm,
      end_time: addOneHour(slotForm.start_time),
      arena_name: arena?.name,
      is_late_game: isLate(slotForm.start_time),
      is_available: true,
    };
    if (existing) {
      await base44.entities.IceSlot.update(existing.id, data);
    } else {
      await base44.entities.IceSlot.create(data);
    }
    setShowSlotForm(false);
    setSlotForm({ arena_id: "", date: "", start_time: "", season: "2025-2026" });
    loadAll();
  };

  const saveBulk = async () => {
    const arena = arenas.find(a => a.id === bulkForm.arena_id);
    const slotsToCreate = [];
    const start = new Date(bulkForm.start_date + "T12:00:00");
    const end = new Date(bulkForm.end_date + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (bulkForm.days_of_week.includes(String(d.getDay()))) {
        const dateStr = d.toISOString().split("T")[0];
        // skip duplicates
        const dup = slots.find(s => s.arena_id === bulkForm.arena_id && s.date === dateStr && s.start_time === bulkForm.start_time);
        if (!dup) {
          slotsToCreate.push({
            arena_id: bulkForm.arena_id,
            arena_name: arena?.name,
            date: dateStr,
            start_time: bulkForm.start_time,
            end_time: addOneHour(bulkForm.start_time),
            season: bulkForm.season,
            is_late_game: isLate(bulkForm.start_time),
            is_available: true,
          });
        }
      }
    }
    if (slotsToCreate.length === 0) { alert("No new slots to create (all may already exist)."); return; }
    setBulkMode(false);
    const total = slotsToCreate.length;
    setProgress({ title: "Creating Ice Slots", current: 0, total });
    // bulkCreate in chunks of 50 to avoid rate limits
    let done = 0;
    for (let i = 0; i < slotsToCreate.length; i += 50) {
      const chunk = slotsToCreate.slice(i, i + 50);
      await base44.entities.IceSlot.bulkCreate(chunk);
      done += chunk.length;
      setProgress({ title: "Creating Ice Slots", current: done, total });
      if (i + 50 < slotsToCreate.length) await new Promise(r => setTimeout(r, 1000));
    }
    setProgress(null);
    loadAll();
  };

  // Delete a single slot
  const deleteSlot = async (slot) => {
    if (!confirm("Delete this slot?")) return;
    // If used, clear game reference first
    const linked = games.filter(g =>
      g.ice_slot_id === slot.id ||
      (g.arena_id === slot.arena_id && g.date === slot.date && g.start_time === slot.start_time)
    );
    for (const g of linked) await base44.entities.Game.update(g.id, { ice_slot_id: "" });
    await base44.entities.IceSlot.delete(slot.id);
    setSlots(prev => prev.filter(s => s.id !== slot.id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(slot.id); return n; });
  };

  // Delete selected — sequential, cancel-able
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} slot(s)? Game references will also be cleared.`)) return;
    const ids = [...selectedIds];
    cancelRef.current = false;
    setProgress({ title: "Deleting Ice Slots", current: 0, total: ids.length });

    for (let i = 0; i < ids.length; i++) {
      if (cancelRef.current) break;
      const id = ids[i];
      const slot = slots.find(s => s.id === id);
      if (slot) {
        const linked = games.filter(g =>
          g.ice_slot_id === slot.id ||
          (g.arena_id === slot.arena_id && g.date === slot.date && g.start_time === slot.start_time)
        );
        for (const g of linked) {
          await base44.entities.Game.update(g.id, { ice_slot_id: "" });
          await new Promise(r => setTimeout(r, 400));
        }
      }
      await base44.entities.IceSlot.delete(id);
      setProgress({ title: "Deleting Ice Slots", current: i + 1, total: ids.length });
      await new Promise(r => setTimeout(r, 400));
    }
    setProgress(null);
    await loadAll();
  };

  // Unassign: mark available + clear game ice_slot_id
  const unassignSelected = async () => {
    const usedSelected = [...selectedIds].filter(id => {
      const slot = slots.find(s => s.id === id);
      return slot && !slot.is_available;
    });
    if (usedSelected.length === 0) { alert("No used slots selected."); return; }
    if (!confirm(`Mark ${usedSelected.length} slot(s) as available? Game assignments referencing these slots will be cleared.`)) return;

    cancelRef.current = false;
    setProgress({ title: "Unassigning Ice Slots", current: 0, total: usedSelected.length });

    for (let i = 0; i < usedSelected.length; i++) {
      if (cancelRef.current) break;
      const slotId = usedSelected[i];
      const slot = slots.find(s => s.id === slotId);
      if (slot) {
        const linked = games.filter(g =>
          g.ice_slot_id === slotId ||
          (g.arena_id === slot.arena_id && g.date === slot.date && g.start_time === slot.start_time)
        );
        for (const g of linked) {
          await base44.entities.Game.update(g.id, { ice_slot_id: "", arena_id: "", arena_name: "" });
          await new Promise(r => setTimeout(r, 400));
        }
      }
      await base44.entities.IceSlot.update(slotId, { is_available: true });
      setProgress({ title: "Unassigning Ice Slots", current: i + 1, total: usedSelected.length });
      await new Promise(r => setTimeout(r, 400));
    }
    setProgress(null);
    await loadAll();
  };

  const filteredSlots = slots.filter(s =>
    (filterArena === "all" || s.arena_id === filterArena) &&
    (!filterDate || s.date === filterDate) &&
    (filterStatus === "all" || (filterStatus === "available" ? s.is_available : !s.is_available))
  );

  const toggleSelect = (id) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAll = () => {
    if (selectedIds.size === filteredSlots.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredSlots.map(s => s.id)));
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const usedCount = slots.filter(s => !s.is_available).length;
  const availableCount = slots.filter(s => s.is_available).length;
  const selectedUsed = [...selectedIds].filter(id => !slots.find(s => s.id === id)?.is_available).length;

  return (
    <div>
      {progress && (
        <ProgressModal
          title={progress.title}
          current={progress.current}
          total={progress.total}
          onCancel={() => { cancelRef.current = true; }}
        />
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Ice Slots & Arenas</h1>
          <p className="text-gray-400 text-sm mt-1">
            {arenas.length} arenas · <span className="text-green-400">{availableCount} available</span> · <span className="text-gray-500">{usedCount} used</span> · {slots.length} total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportSlotsCSV} disabled={slots.length === 0}
            className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: "#c0c0c0" }}>
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setShowCsvImport(true); setCsvResult(null); setCsvFile(null); setCsvProgress({ current: 0, total: 0 }); }}
            className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#c0c0c0" }}>
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowArenaForm(true)} className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#d4af37" }}>
            <Plus className="w-4 h-4" /> Arena
          </button>
          <button onClick={() => setBulkMode(true)} className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#c0c0c0" }}>
            <Plus className="w-4 h-4" /> Bulk Slots
          </button>
          <button onClick={() => setShowSlotForm(true)} className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#c0c0c0" }}>
            <Plus className="w-4 h-4" /> Single Slot
          </button>
        </div>
      </div>

      {/* Ice Slot Calculator */}
      <IceSlotCalculator slots={slots} divisions={divisions} teams={teams} />

      {/* Arenas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {arenas.map(a => (
          <div key={a.id} className="rounded-lg p-3 border border-gray-800 flex items-center justify-between" style={{ background: "#111" }}>
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-1"><MapPin className="w-3.5 h-3.5" style={{ color: "#d4af37" }} /> {a.name}</div>
              {a.address && <div className="text-xs text-gray-500 mt-0.5">{a.address}</div>}
              <div className="text-xs text-gray-400 mt-1">
                {slots.filter(s => s.arena_id === a.id && s.is_available).length} available /&nbsp;
                {slots.filter(s => s.arena_id === a.id).length} total
              </div>
            </div>
            <button onClick={() => deleteArena(a.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Filters + bulk actions */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <select className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          value={filterArena} onChange={e => setFilterArena(e.target.value)}>
          <option value="all">All Arenas</option>
          {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <select className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="used">Used</option>
        </select>
        {filterDate && <button onClick={() => setFilterDate("")} className="text-gray-500 hover:text-white text-sm px-2">Clear date</button>}

        <button onClick={selectAll} className="flex items-center gap-1.5 border border-gray-700 text-gray-400 px-3 py-2 rounded-lg text-sm hover:text-white" style={{ background: "#111" }}>
          {selectedIds.size === filteredSlots.length && filteredSlots.length > 0
            ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} />
            : <Square className="w-4 h-4" />}
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select All"}
        </button>

        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            {selectedUsed > 0 && (
              <button onClick={unassignSelected}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "#d4af37", color: "#d4af37" }}>
                <RefreshCw className="w-4 h-4" /> Unassign {selectedUsed} Used
              </button>
            )}
            <button onClick={deleteSelected}
              className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Delete {selectedIds.size}
            </button>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 mb-2">
        Showing {Math.min(filteredSlots.length, 300)} of {filteredSlots.length} slots
        {filteredSlots.length > 300 && " — use filters to narrow results"}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="rounded-lg h-12 animate-pulse" style={{ background: "#111" }} />)}</div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#0d0d0d" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800" style={{ background: "#111" }}>
                <th className="px-4 py-3 w-10">
                  <button onClick={selectAll} className="text-gray-500 hover:text-white">
                    {selectedIds.size === filteredSlots.length && filteredSlots.length > 0
                      ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Arena</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Season</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {filteredSlots.slice(0, 300).map(slot => (
                <tr key={slot.id} className={`transition-colors ${selectedIds.has(slot.id) ? "bg-yellow-500/5" : "hover:bg-white/2"}`}>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleSelect(slot.id)} className="text-gray-600 hover:text-yellow-400">
                      {selectedIds.has(slot.id) ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-white">{slot.date}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-300">{slot.arena_name}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-600" />
                      {slot.start_time} – {slot.end_time || addOneHour(slot.start_time)}
                      {slot.is_late_game && <span className="flex items-center gap-0.5 text-xs text-yellow-400"><Moon className="w-3 h-3" />Late</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{slot.season}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${slot.is_available ? "border-green-500/30 text-green-400 bg-green-500/5" : "border-gray-700 text-gray-500 bg-gray-800/30"}`}>
                      {slot.is_available ? "Available" : "Used"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!slot.is_available && (
                        <button onClick={async () => {
                          const linked = games.filter(g =>
                            g.ice_slot_id === slot.id ||
                            (g.arena_id === slot.arena_id && g.date === slot.date && g.start_time === slot.start_time)
                          );
                          for (const g of linked) await base44.entities.Game.update(g.id, { ice_slot_id: "" });
                          await base44.entities.IceSlot.update(slot.id, { is_available: true });
                          setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, is_available: true } : s));
                        }} className="p-1 text-gray-600 hover:text-yellow-400" title="Mark as available">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => deleteSlot(slot)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSlots.length === 0 && <p className="text-center py-8 text-gray-600">No slots found.</p>}
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-lg relative" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Import Ice Slots from CSV</h2>
              <button onClick={() => setShowCsvImport(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="rounded-lg p-3 mb-4 text-xs border" style={{ background: "#1a1a00", borderColor: "#d4af3730", color: "#d4af37" }}>
              Columns: <strong>arena_name, date (YYYY-MM-DD), start_time (HH:MM), season</strong><br />
              Duplicates (same arena + date + time) will be updated/overwritten, not duplicated.
            </div>
            <button onClick={downloadSlotsTemplate} className="flex items-center gap-2 text-sm mb-4 underline" style={{ color: "#c0c0c0" }}>
              <Download className="w-4 h-4" /> Download template CSV
            </button>
            <div>
              <label className="text-sm text-gray-400 block mb-1">CSV File *</label>
              <input type="file" accept=".csv" className="w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-black file:text-sm file:cursor-pointer cursor-pointer"
                onChange={e => setCsvFile(e.target.files[0])} />
            </div>
            {csvImporting && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{csvProgress.phase || "Importing"} — {csvProgress.current} of {csvProgress.total}</span>
                  <span>{csvProgress.total > 0 ? Math.round((csvProgress.current / csvProgress.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${csvProgress.total > 0 ? Math.round((csvProgress.current / csvProgress.total) * 100) : 0}%`, background: "linear-gradient(90deg,#c0c0c0,#d4af37)" }} />
                </div>
              </div>
            )}
            {csvResult && !csvImporting && (
              <div className="mt-3 rounded-lg p-3 text-sm border border-green-500/20 text-green-400" style={{ background: "#001a00" }}>
                ✓ {csvResult.created} created{csvResult.skipped > 0 ? ` · ${csvResult.skipped} skipped (missing date/time)` : ""}.
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCsvImport(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Close</button>
              <button onClick={handleCsvImport} disabled={!csvFile || csvImporting}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: "#c0c0c0" }}>
                {csvImporting ? "Importing..." : "Import (Overwrite All)"}
              </button>
            </div>

            {/* Confirm overwrite modal */}
            {csvConfirmPending && (
              <div className="absolute inset-0 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
                <div className="rounded-xl border border-gray-700 p-6 m-4" style={{ background: "#1a1a1a" }}>
                  <h3 className="text-white font-semibold mb-2">⚠️ Overwrite All Ice Slots?</h3>
                  <p className="text-sm text-gray-400 mb-4">This will <strong className="text-red-400">delete all existing ice slots</strong> and replace them with the CSV contents. This cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setCsvConfirmPending(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
                    <button onClick={confirmAndImport} className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">Yes, Overwrite</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Arena Modal */}
      {showArenaForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-sm" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Arena</h2>
              <button onClick={() => setShowArenaForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena Name *</label>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  value={arenaForm.name} onChange={e => setArenaForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Address</label>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  value={arenaForm.address} onChange={e => setArenaForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowArenaForm(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={saveArena} disabled={!arenaForm.name} className="flex-1 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: "#d4af37" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Slot Modal */}
      {showSlotForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-sm" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Ice Slot</h2>
              <button onClick={() => setShowSlotForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena *</label>
                <select className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={slotForm.arena_id} onChange={e => setSlotForm(f => ({ ...f, arena_id: e.target.value }))}>
                  <option value="">Select arena...</option>
                  {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Date *</label>
                <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Start Time *</label>
                <input type="time" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} />
                {slotForm.start_time && <p className="text-xs text-gray-600 mt-1">End time: {addOneHour(slotForm.start_time)}</p>}
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Season</label>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={slotForm.season} onChange={e => setSlotForm(f => ({ ...f, season: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowSlotForm(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={saveSlot} disabled={!slotForm.arena_id || !slotForm.date || !slotForm.start_time}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: "#c0c0c0" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Slot Modal */}
      {bulkMode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-md" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Bulk Add Ice Slots</h2>
              <button onClick={() => setBulkMode(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena *</label>
                <select className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                  value={bulkForm.arena_id} onChange={e => setBulkForm(f => ({ ...f, arena_id: e.target.value }))}>
                  <option value="">Select arena...</option>
                  {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Start Date</label>
                  <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                    value={bulkForm.start_date} onChange={e => setBulkForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">End Date</label>
                  <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                    value={bulkForm.end_date} onChange={e => setBulkForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Days of Week</label>
                <div className="flex gap-2 flex-wrap">
                  {dayNames.map((day, i) => (
                    <button key={i} type="button"
                      onClick={() => setBulkForm(f => ({ ...f, days_of_week: f.days_of_week.includes(String(i)) ? f.days_of_week.filter(d => d !== String(i)) : [...f.days_of_week, String(i)] }))}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{ background: bulkForm.days_of_week.includes(String(i)) ? "#d4af37" : "#333", color: bulkForm.days_of_week.includes(String(i)) ? "#000" : "#999" }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Start Time</label>
                <input type="time" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                  value={bulkForm.start_time} onChange={e => setBulkForm(f => ({ ...f, start_time: e.target.value }))} />
                {bulkForm.start_time && <p className="text-xs text-gray-600 mt-1">End time auto-set to {addOneHour(bulkForm.start_time)}</p>}
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Season</label>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                  value={bulkForm.season} onChange={e => setBulkForm(f => ({ ...f, season: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setBulkMode(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={saveBulk} className="flex-1 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#c0c0c0" }}>Create Slots</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}