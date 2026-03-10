import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * PublicData — embeddable, no-login page for sharing PuckOps data.
 * 
 * Usage in another Base44 app:
 *   <iframe src="https://YOUR_APP_URL/public-data?view=schedule&season=2025-2026" />
 *   <iframe src="https://YOUR_APP_URL/public-data?view=teams&season=2025-2026" />
 *   <iframe src="https://YOUR_APP_URL/public-data?view=json&season=2025-2026" />  ← raw JSON
 * 
 * URL params:
 *   view    = schedule | teams | json   (default: schedule)
 *   season  = e.g. 2025-2026            (default: all)
 *   division= division name filter       (optional)
 *   format  = embed | full              (default: full; embed hides chrome)
 */

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

const param = (key, fallback = "") => {
  const p = new URLSearchParams(window.location.search);
  return p.get(key) || fallback;
};

export default function PublicData() {
  const view = param("view", "schedule");
  const season = param("season", "");
  const divisionFilter = param("division", "");
  const isEmbed = param("format") === "embed";

  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [g, t, d] = await Promise.all([
        base44.entities.Game.list("date", 2000),
        base44.entities.Team.list(),
        base44.entities.Division.list(),
      ]);
      setGames(g);
      setTeams(t);
      setDivisions(d);
      setLoading(false);
    };
    load();
  }, []);

  const filteredGames = games.filter(g =>
    (!season || g.season === season) &&
    (!divisionFilter || g.division_name?.toLowerCase() === divisionFilter.toLowerCase()) &&
    g.status === "scheduled"
  );

  const filteredTeams = teams.filter(t =>
    (!season || t.season === season) &&
    (!divisionFilter || t.division_name?.toLowerCase() === divisionFilter.toLowerCase())
  );

  // Raw JSON view — useful for fetch() calls from another app
  if (view === "json") {
    const payload = {
      source: "PuckOps",
      generated: new Date().toISOString(),
      season: season || "all",
      games: filteredGames.map(g => ({
        id: g.id, date: g.date, start_time: g.start_time,
        home_team: g.home_team_name, away_team: g.away_team_name,
        division: g.division_name, arena: g.arena_name,
        status: g.status, is_late_game: g.is_late_game,
      })),
      teams: filteredTeams.map(t => ({
        id: t.id, name: t.name, division: t.division_name,
        manager: t.manager_name, manager_email: t.manager_email,
        season: t.season,
      })),
    };
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 16 }}>
        <pre style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {loading ? "Loading..." : JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    );
  }

  const groupedGames = filteredGames.reduce((acc, g) => {
    (acc[g.date] = acc[g.date] || []).push(g);
    return acc;
  }, {});

  const groupedTeams = filteredTeams.reduce((acc, t) => {
    (acc[t.division_name || "Unassigned"] = acc[t.division_name || "Unassigned"] || []).push(t);
    return acc;
  }, {});

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "white", fontFamily: "system-ui, sans-serif" }}>
      {!isEmbed && (
        <div style={{ background: "#0a0a0a", borderBottom: "1px solid #222", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: SILVER }}>Puck</span>
          <span style={{ fontWeight: 900, fontSize: 18, color: GOLD }}>Ops</span>
          <span style={{ color: "#555", fontSize: 13, marginLeft: 8 }}>Public Data Feed</span>
          {season && <span style={{ marginLeft: "auto", fontSize: 12, color: "#666", background: "#111", border: "1px solid #333", borderRadius: 6, padding: "2px 8px" }}>{season}</span>}
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "0 20px", display: "flex", gap: 0 }}>
        {["schedule", "teams"].map(v => (
          <a key={v} href={`?view=${v}${season ? `&season=${season}` : ""}${divisionFilter ? `&division=${divisionFilter}` : ""}${isEmbed ? "&format=embed" : ""}`}
            style={{
              padding: "12px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none", borderBottom: "2px solid",
              borderBottomColor: view === v ? GOLD : "transparent",
              color: view === v ? GOLD : "#666",
            }}>
            {v === "schedule" ? `Schedule (${filteredGames.length})` : `Teams (${filteredTeams.length})`}
          </a>
        ))}
        <a href={`?view=json${season ? `&season=${season}` : ""}${divisionFilter ? `&division=${divisionFilter}` : ""}`}
          style={{ padding: "12px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none", borderBottom: "2px solid transparent", color: "#444", marginLeft: "auto" }}>
          JSON ↗
        </a>
      </div>

      <div style={{ padding: "20px" }}>
        {loading ? (
          <div style={{ color: "#555", textAlign: "center", paddingTop: 40 }}>Loading...</div>
        ) : view === "schedule" ? (
          Object.keys(groupedGames).length === 0 ? (
            <div style={{ color: "#555", textAlign: "center", paddingTop: 40 }}>No scheduled games found.</div>
          ) : (
            Object.entries(groupedGames).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayGames]) => (
              <div key={date} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  {new Date(date + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayGames.map(g => (
                    <div key={g.id} style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ color: "#888", fontSize: 12, minWidth: 45 }}>{g.start_time}</span>
                      <span style={{ color: "#555", fontSize: 11, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 4, padding: "1px 6px" }}>{g.division_name}</span>
                      <span style={{ color: "white", fontSize: 13, fontWeight: 600, flex: 1 }}>
                        {g.home_team_name} <span style={{ color: "#555" }}>vs</span> {g.away_team_name}
                      </span>
                      <span style={{ color: "#555", fontSize: 12 }}>{g.arena_name}</span>
                      {g.is_late_game && <span style={{ color: GOLD, fontSize: 11 }}>🌙</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )
        ) : (
          Object.keys(groupedTeams).length === 0 ? (
            <div style={{ color: "#555", textAlign: "center", paddingTop: 40 }}>No teams found.</div>
          ) : (
            Object.entries(groupedTeams).sort(([a], [b]) => a.localeCompare(b)).map(([divName, divTeams]) => (
              <div key={divName} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{divName}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {divTeams.map(t => (
                    <div key={t.id} style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                      {t.manager_name && <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>{t.manager_name}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {!isEmbed && (
        <div style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "20px", marginTop: 20 }}>
          <div style={{ color: "#555", fontSize: 12, marginBottom: 12 }}>Embed this data in another app:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Schedule iframe", code: `<iframe src="${window.location.origin}/public-data?view=schedule&season=2025-2026&format=embed" width="100%" height="600" style="border:none" />` },
              { label: "Teams iframe", code: `<iframe src="${window.location.origin}/public-data?view=teams&season=2025-2026&format=embed" width="100%" height="400" style="border:none" />` },
              { label: "JSON fetch (schedule + teams)", code: `const res = await fetch("${window.location.origin}/public-data?view=json&season=2025-2026");\nconst html = await res.text(); // parse the <pre> tag content` },
            ].map(({ label, code }) => (
              <div key={label}>
                <div style={{ color: "#666", fontSize: 11, marginBottom: 4 }}>{label}</div>
                <code style={{ display: "block", background: "#111", border: "1px solid #222", borderRadius: 6, padding: "8px 12px", color: SILVER, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{code}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}