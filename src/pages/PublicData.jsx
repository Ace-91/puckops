import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * PuckOps Public Data Feed
 * 
 * URL params:
 *   view    = schedule | teams | standings | json
 *   season  = e.g. 2025-2026  (default: all)
 *   division= division name filter (optional)
 *   format  = embed | full
 */

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

const param = (key, fallback = "") => {
  const p = new URLSearchParams(window.location.search);
  return p.get(key) || fallback;
};

const baseUrl = () => window.location.origin + "/public-data";

// ── Data view (used when embedded/linked directly) ────────────────────────────
function DataView({ view, season, divisionFilter, isEmbed, games, teams, divisions, loading }) {
  const filteredGames = games.filter(g =>
    (!season || g.season === season) &&
    (!divisionFilter || g.division_name?.toLowerCase() === divisionFilter.toLowerCase()) &&
    g.status === "scheduled"
  );

  const filteredTeams = teams.filter(t =>
    (!season || t.season === season) &&
    (!divisionFilter || t.division_name?.toLowerCase() === divisionFilter.toLowerCase())
  );

  // standings: count wins/losses per team from completed games
  const completedGames = games.filter(g =>
    (!season || g.season === season) && g.status === "completed"
  );
  const standingsMap = {};
  completedGames.forEach(g => {
    [g.home_team_id, g.away_team_id].forEach(id => {
      if (!standingsMap[id]) standingsMap[id] = { name: id === g.home_team_id ? g.home_team_name : g.away_team_name, division: g.division_name, gp: 0, w: 0, l: 0 };
    });
    if (g.winner_team_id) {
      if (standingsMap[g.winner_team_id]) standingsMap[g.winner_team_id].w++;
      const loser = g.home_team_id === g.winner_team_id ? g.away_team_id : g.home_team_id;
      if (standingsMap[loser]) standingsMap[loser].l++;
    }
    if (standingsMap[g.home_team_id]) standingsMap[g.home_team_id].gp++;
    if (standingsMap[g.away_team_id]) standingsMap[g.away_team_id].gp++;
  });

  if (view === "json") {
    const payload = buildJson(filteredGames, filteredTeams, standingsMap, season);
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 16 }}>
        <pre style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {loading ? "Loading..." : JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    );
  }

  const groupedGames = filteredGames.reduce((acc, g) => {
    (acc[g.date] = acc[g.date] || []).push(g); return acc;
  }, {});

  const groupedTeams = filteredTeams.reduce((acc, t) => {
    (acc[t.division_name || "Unassigned"] = acc[t.division_name || "Unassigned"] || []).push(t); return acc;
  }, {});

  const standingsByDiv = Object.values(standingsMap).reduce((acc, s) => {
    (acc[s.division || "Unknown"] = acc[s.division || "Unknown"] || []).push(s); return acc;
  }, {});

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "white", fontFamily: "system-ui, sans-serif" }}>
      {!isEmbed && (
        <div style={{ background: "#0a0a0a", borderBottom: "1px solid #222", padding: "12px 20px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: SILVER }}>Puck</span>
          <span style={{ fontWeight: 900, fontSize: 18, color: GOLD }}>Ops</span>
          <span style={{ color: "#555", fontSize: 13, marginLeft: 8 }}>Live Data</span>
          {season && <span style={{ marginLeft: "auto", fontSize: 12, color: "#666", background: "#111", border: "1px solid #333", borderRadius: 6, padding: "2px 8px" }}>{season}</span>}
        </div>
      )}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
        {["schedule", "teams", "standings"].map(v => (
          <a key={v} href={`?view=${v}${season ? `&season=${season}` : ""}${divisionFilter ? `&division=${divisionFilter}` : ""}${isEmbed ? "&format=embed" : ""}`}
            style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none", borderBottom: "2px solid", whiteSpace: "nowrap",
              borderBottomColor: view === v ? GOLD : "transparent", color: view === v ? GOLD : "#555" }}>
            {v === "schedule" ? `Schedule (${filteredGames.length})` : v === "teams" ? `Teams (${filteredTeams.length})` : "Standings"}
          </a>
        ))}
      </div>
      <div style={{ padding: "20px" }}>
        {loading ? <div style={{ color: "#555", textAlign: "center", paddingTop: 40 }}>Loading...</div>
          : view === "schedule" ? (
            Object.keys(groupedGames).length === 0
              ? <div style={{ color: "#555", textAlign: "center", paddingTop: 40 }}>No scheduled games found.</div>
              : Object.entries(groupedGames).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayGames]) => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                    {new Date(date + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                  {dayGames.map(g => (
                    <div key={g.id} style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ color: "#777", fontSize: 12, minWidth: 45 }}>{g.start_time}</span>
                      <span style={{ color: "#555", fontSize: 11, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 4, padding: "1px 6px" }}>{g.division_name}</span>
                      <span style={{ color: "white", fontSize: 13, fontWeight: 600, flex: 1 }}>{g.home_team_name} <span style={{ color: "#444" }}>vs</span> {g.away_team_name}</span>
                      <span style={{ color: "#555", fontSize: 12 }}>{g.arena_name}</span>
                      {g.is_late_game && <span style={{ color: GOLD, fontSize: 11 }}>🌙</span>}
                    </div>
                  ))}
                </div>
              ))
          ) : view === "teams" ? (
            Object.keys(groupedTeams).length === 0
              ? <div style={{ color: "#555", textAlign: "center", paddingTop: 40 }}>No teams found.</div>
              : Object.entries(groupedTeams).sort(([a], [b]) => a.localeCompare(b)).map(([divName, divTeams]) => (
                <div key={divName} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{divName}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                    {divTeams.map(t => (
                      <div key={t.id} style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                        {t.manager_name && <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{t.manager_name}</div>}
                        {t.manager_email && <div style={{ color: "#444", fontSize: 11, marginTop: 1 }}>{t.manager_email}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            Object.keys(standingsByDiv).length === 0
              ? <div style={{ color: "#555", textAlign: "center", paddingTop: 40 }}>No completed games yet.</div>
              : Object.entries(standingsByDiv).map(([div, rows]) => (
                <div key={div} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{div}</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "#555", fontSize: 11 }}>
                        {["Team", "GP", "W", "L", "Pts"].map(h => <th key={h} style={{ textAlign: h === "Team" ? "left" : "center", padding: "4px 8px", borderBottom: "1px solid #1a1a1a" }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.sort((a, b) => (b.w * 2) - (a.w * 2)).map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                          <td style={{ padding: "6px 8px", color: "white" }}>{r.name}</td>
                          <td style={{ padding: "6px 8px", color: "#888", textAlign: "center" }}>{r.gp}</td>
                          <td style={{ padding: "6px 8px", color: "#4ade80", textAlign: "center" }}>{r.w}</td>
                          <td style={{ padding: "6px 8px", color: "#f87171", textAlign: "center" }}>{r.l}</td>
                          <td style={{ padding: "6px 8px", color: GOLD, fontWeight: 700, textAlign: "center" }}>{r.w * 2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
          )}
      </div>
    </div>
  );
}

function buildJson(filteredGames, filteredTeams, standingsMap, season) {
  return {
    source: "PuckOps",
    generated: new Date().toISOString(),
    season: season || "all",
    games: filteredGames.map(g => ({
      id: g.id, date: g.date, start_time: g.start_time, end_time: g.end_time,
      home_team: g.home_team_name, home_team_id: g.home_team_id,
      away_team: g.away_team_name, away_team_id: g.away_team_id,
      division: g.division_name, division_id: g.division_id,
      arena: g.arena_name, arena_id: g.arena_id,
      status: g.status, game_type: g.game_type,
      is_late_game: g.is_late_game, season: g.season,
    })),
    teams: filteredTeams.map(t => ({
      id: t.id, name: t.name,
      division: t.division_name, division_id: t.division_id,
      manager_name: t.manager_name, manager_email: t.manager_email,
      manager_phone: t.manager_phone, season: t.season,
      is_active: t.is_active,
    })),
    standings: Object.values(standingsMap),
  };
}

// ── Integration Console (admin view) ─────────────────────────────────────────
function IntegrationConsole({ games, teams, divisions, loading }) {
  const [season, setSeason] = useState("2025-2026");
  const [division, setDivision] = useState("");
  const [activeEndpoint, setActiveEndpoint] = useState("schedule");
  const [copied, setCopied] = useState("");

  const seasons = [...new Set(games.map(g => g.season).filter(Boolean))];
  const divisionNames = [...new Set(teams.map(t => t.division_name).filter(Boolean))];

  const buildUrl = (view, extra = "") =>
    `${baseUrl()}?view=${view}&season=${encodeURIComponent(season)}${division ? `&division=${encodeURIComponent(division)}` : ""}${extra}`;

  const endpoints = [
    {
      id: "schedule",
      label: "Schedule",
      description: "All upcoming scheduled games, grouped by date",
      url: buildUrl("schedule"),
      embedUrl: buildUrl("schedule", "&format=embed"),
      fields: ["id", "date", "start_time", "end_time", "home_team", "away_team", "division", "arena", "status", "is_late_game", "season"],
    },
    {
      id: "teams",
      label: "Teams",
      description: "All teams with division and manager contact info",
      url: buildUrl("teams"),
      embedUrl: buildUrl("teams", "&format=embed"),
      fields: ["id", "name", "division", "manager_name", "manager_email", "manager_phone", "season", "is_active"],
    },
    {
      id: "standings",
      label: "Standings",
      description: "Win/loss standings calculated from completed games",
      url: buildUrl("standings"),
      embedUrl: buildUrl("standings", "&format=embed"),
      fields: ["name", "division", "gp", "w", "l", "pts"],
    },
    {
      id: "json",
      label: "JSON (all)",
      description: "Single JSON response with games + teams + standings — fetch() this in your other app",
      url: buildUrl("json"),
      embedUrl: null,
      fields: ["games[]", "teams[]", "standings[]", "source", "generated", "season"],
    },
  ];

  const ep = endpoints.find(e => e.id === activeEndpoint);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const iframeSnippet = ep?.embedUrl
    ? `<iframe\n  src="${ep.embedUrl}"\n  width="100%"\n  height="600"\n  style="border:none;border-radius:8px"\n/>`
    : null;

  const fetchSnippet = `// In your other Base44 app:
const res = await fetch("${buildUrl("json")}");
const text = await res.text();
// Parse JSON from the <pre> tag
const json = JSON.parse(text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1] || "{}");
const { games, teams, standings } = json;`;

  const reactSnippet = `import { useEffect, useState } from "react";

export function usePuckOpsData(season = "${season}") {
  const [data, setData] = useState({ games: [], teams: [], standings: [] });
  useEffect(() => {
    fetch(\`${baseUrl()}?view=json&season=\${season}\`)
      .then(r => r.text())
      .then(html => {
        const raw = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1] || "{}";
        setData(JSON.parse(raw));
      });
  }, [season]);
  return data;
}`;

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "white", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0a0a0a", borderBottom: "1px solid #222", padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 20, color: SILVER }}>Puck</span>
          <span style={{ fontWeight: 900, fontSize: 20, color: GOLD }}>Ops</span>
          <span style={{ color: "#555", fontSize: 14, marginLeft: 4 }}>Integration Console</span>
        </div>
        <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
          Test endpoints, preview data, and copy embed code for your other app.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "calc(100vh - 73px)" }}>
        {/* Sidebar */}
        <div style={{ background: "#080808", borderRight: "1px solid #1a1a1a", padding: 16 }}>
          {/* Filters */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Filters</div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Season</label>
              <select value={season} onChange={e => setSeason(e.target.value)}
                style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: "6px 8px", color: "white", fontSize: 12 }}>
                {seasons.length === 0 && <option value="2025-2026">2025-2026</option>}
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Division</label>
              <select value={division} onChange={e => setDivision(e.target.value)}
                style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: "6px 8px", color: "white", fontSize: 12 }}>
                <option value="">All Divisions</option>
                {divisionNames.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Endpoints */}
          <div>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Endpoints</div>
            {endpoints.map(e => (
              <button key={e.id} onClick={() => setActiveEndpoint(e.id)}
                style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "1px solid", marginBottom: 4, cursor: "pointer",
                  borderColor: activeEndpoint === e.id ? GOLD : "#1a1a1a",
                  background: activeEndpoint === e.id ? "rgba(212,175,55,0.08)" : "#0d0d0d",
                  color: activeEndpoint === e.id ? GOLD : "#888" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.label}</div>
                <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{e.description.slice(0, 40)}...</div>
              </button>
            ))}
          </div>

          {/* Live link */}
          <div style={{ marginTop: 20, padding: 12, background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>Preview in browser ↗</div>
            <a href={ep?.url} target="_blank" rel="noopener noreferrer"
              style={{ color: SILVER, fontSize: 11, wordBreak: "break-all", textDecoration: "none" }}>
              {ep?.url}
            </a>
          </div>
        </div>

        {/* Main panel */}
        <div style={{ padding: 24, overflowY: "auto" }}>
          {ep && (
            <>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{ep.label} Endpoint</h2>
              <p style={{ color: "#666", fontSize: 13, margin: "0 0 24px" }}>{ep.description}</p>

              {/* Data fields exposed */}
              <Section title="Data Fields Exposed">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ep.fields.map(f => (
                    <span key={f} style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: SILVER, fontFamily: "monospace" }}>{f}</span>
                  ))}
                </div>
              </Section>

              {/* iframe embed */}
              {iframeSnippet && (
                <Section title="Embed as iframe (paste into your other app)">
                  <CodeBlock code={iframeSnippet} onCopy={() => copy(iframeSnippet, "iframe")} copied={copied === "iframe"} />
                </Section>
              )}

              {/* fetch snippet */}
              <Section title="Fetch via JavaScript">
                <CodeBlock code={fetchSnippet} onCopy={() => copy(fetchSnippet, "fetch")} copied={copied === "fetch"} />
              </Section>

              {/* React hook */}
              <Section title="React Hook (paste into your other app)">
                <CodeBlock code={reactSnippet} onCopy={() => copy(reactSnippet, "hook")} copied={copied === "hook"} />
              </Section>

              {/* Live preview */}
              <Section title="Live Preview">
                <div style={{ border: "1px solid #1a1a1a", borderRadius: 8, overflow: "hidden", height: 400 }}>
                  <iframe src={ep.url} style={{ width: "100%", height: "100%", border: "none" }} title="Live Preview" />
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function CodeBlock({ code, onCopy, copied }) {
  return (
    <div style={{ position: "relative" }}>
      <pre style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8, padding: "12px 16px", fontSize: 12, fontFamily: "monospace", color: SILVER, whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
        {code}
      </pre>
      <button onClick={onCopy}
        style={{ position: "absolute", top: 8, right: 8, background: copied ? "#22c55e22" : "#1a1a1a", border: `1px solid ${copied ? "#22c55e" : "#333"}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: copied ? "#4ade80" : "#888", cursor: "pointer" }}>
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function PublicData() {
  const view = param("view", "");
  const season = param("season", "");
  const divisionFilter = param("division", "");
  const isEmbed = param("format") === "embed";

  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Game.list("date", 2000),
      base44.entities.Team.list(),
      base44.entities.Division.list(),
    ]).then(([g, t, d]) => {
      setGames(g); setTeams(t); setDivisions(d); setLoading(false);
    });
  }, []);

  // No view param = show the integration console
  if (!view) return <IntegrationConsole games={games} teams={teams} divisions={divisions} loading={loading} />;

  return <DataView view={view} season={season} divisionFilter={divisionFilter} isEmbed={isEmbed}
    games={games} teams={teams} divisions={divisions} loading={loading} />;
}