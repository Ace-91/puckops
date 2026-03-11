import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Verify the shared webhook secret
    const incomingSecret = req.headers.get('x-puckleague-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = Deno.env.get('PUCKLEAGUE_WEBHOOK_SECRET');

    if (!incomingSecret || incomingSecret !== expectedSecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { event, external_id, data } = body;

    if (!event || !external_id) {
        return Response.json({ error: 'Missing event or external_id' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Find the league in PuckOperations that matches this external_id
    const leagues = await base44.asServiceRole.entities.League.filter({ external_id });
    if (!leagues || leagues.length === 0) {
        return Response.json({ error: `No league found with external_id: ${external_id}` }, { status: 404 });
    }
    const league = leagues[0];

    if (!league.puckleague_sync_enabled) {
        return Response.json({ error: 'Sync not enabled for this league' }, { status: 403 });
    }

    const leagueId = league.id;
    const results = { event, league_id: leagueId, processed: [] };

    // Handle different sync events from PuckLeague
    switch (event) {

        case 'team.created':
        case 'team.updated': {
            // Upsert team by external team ID stored in season field or manager_email as lookup
            const existing = await base44.asServiceRole.entities.Team.filter({ league_id: leagueId, name: data.name });
            if (existing.length > 0) {
                await base44.asServiceRole.entities.Team.update(existing[0].id, {
                    manager_email: data.manager_email || existing[0].manager_email,
                    manager_name: data.manager_name || existing[0].manager_name,
                    manager_phone: data.manager_phone || existing[0].manager_phone,
                });
                results.processed.push({ action: 'updated', entity: 'team', name: data.name });
            } else {
                await base44.asServiceRole.entities.Team.create({
                    league_id: leagueId,
                    name: data.name,
                    division_name: data.division_name || '',
                    manager_email: data.manager_email || '',
                    manager_name: data.manager_name || '',
                    manager_phone: data.manager_phone || '',
                    season: data.season || '',
                    is_active: true,
                });
                results.processed.push({ action: 'created', entity: 'team', name: data.name });
            }
            break;
        }

        case 'game.created':
        case 'game.updated': {
            const existing = await base44.asServiceRole.entities.Game.filter({
                league_id: leagueId,
                date: data.date,
                home_team_name: data.home_team_name,
                away_team_name: data.away_team_name,
            });
            if (existing.length > 0) {
                await base44.asServiceRole.entities.Game.update(existing[0].id, {
                    status: data.status || existing[0].status,
                    start_time: data.start_time || existing[0].start_time,
                    arena_name: data.arena_name || existing[0].arena_name,
                });
                results.processed.push({ action: 'updated', entity: 'game', date: data.date });
            } else {
                await base44.asServiceRole.entities.Game.create({
                    league_id: leagueId,
                    date: data.date,
                    start_time: data.start_time || '',
                    home_team_name: data.home_team_name || '',
                    away_team_name: data.away_team_name || '',
                    arena_name: data.arena_name || '',
                    division_name: data.division_name || '',
                    status: data.status || 'scheduled',
                    game_type: data.game_type || 'regular',
                    season: data.season || '',
                });
                results.processed.push({ action: 'created', entity: 'game', date: data.date });
            }
            break;
        }

        case 'ping':
            results.processed.push({ action: 'pong', league: league.name });
            break;

        default:
            return Response.json({ error: `Unknown event type: ${event}` }, { status: 400 });
    }

    return Response.json({ success: true, ...results });
});