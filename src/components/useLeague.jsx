import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Returns the current user's league_id and user object.
 * leagueId is undefined while loading, null if not set, or a string ID.
 * Use `ready` to gate data fetching: if (!ready || !leagueId) return;
 */
export function useLeague() {
  const [leagueId, setLeagueId] = useState(undefined);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        setUser(u);
        setLeagueId(u?.league_id || null);
      })
      .catch(() => setLeagueId(null));
  }, []);

  return { leagueId, user, ready: leagueId !== undefined };
}